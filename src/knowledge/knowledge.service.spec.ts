import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { join } from 'path';
import { ClockService } from '../clock/clock.service';
import { EmbeddingsClient } from './embeddings.client';
import { KnowledgeService } from './knowledge.service';
import { parseLawXml } from './law-xml.parser';
import { QdrantClient } from './qdrant.client';
import { LawDocument } from './types/law-document';

/**
 * Настоящие клиенты ходят по HTTP в поддельные Gemini и Qdrant,
 * поднятые прямо в тесте. Проверяется вся цепочка, кроме самих сервисов.
 */

/** Слова, по которым поддельная модель строит вектор. */
const KEYWORDS: string[] = ['anwartschaftszeit', 'rahmenfrist', 'dauer', 'versicherungspflicht'];

function fakeVector(text: string): number[] {
  const lower: string = text.toLowerCase();
  const vector: number[] = KEYWORDS.map((word: string): number =>
    lower.split(word).length - 1,
  );
  vector.push(0.1); // чтобы вектор не был нулевым
  return vector;
}

function cosine(a: number[], b: number[]): number {
  const dot: number = a.reduce((sum, value, i) => sum + value * b[i], 0);
  const norm = (v: number[]): number => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return dot / (norm(a) * norm(b));
}

interface FakePoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface Condition {
  key: string;
  match?: { value?: unknown; any?: unknown[] };
  range?: { lt?: number };
}

class FakeServices {
  points: Map<string, FakePoint> = new Map<string, FakePoint>();
  collectionCreated: boolean = false;
  embedCalls: number = 0;
  failEmbedTimes: number = 0;
  receivedApiKey: string | undefined;
  embedRequests: { text: string; taskType?: string }[] = [];
  private server: Server;

  async start(): Promise<string> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private matches(point: FakePoint, filter?: { must: Condition[] }): boolean {
    return (filter?.must ?? []).every((c: Condition): boolean => {
      const value: unknown = point.payload[c.key];
      if (c.match?.any) {
        return c.match.any.includes(value);
      }
      if (c.match) {
        return value === c.match.value;
      }
      return c.range?.lt === undefined || (value as number) < c.range.lt;
    });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let raw: string = '';
    for await (const part of req) {
      raw += part;
    }
    const body = raw ? JSON.parse(raw) : {};
    const url: string = req.url ?? '';
    const send = (status: number, data: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const selected = (): FakePoint[] =>
      [...this.points.values()].filter((p) => this.matches(p, body.filter));

    // ---- Gemini ----
    if (url.endsWith(':batchEmbedContents')) {
      this.embedCalls++;
      this.receivedApiKey = req.headers['x-goog-api-key'] as string;
      for (const r of body.requests) {
        this.embedRequests.push({ text: r.content.parts[0].text, taskType: r.taskType });
      }
      if (this.failEmbedTimes > 0) {
        this.failEmbedTimes--;
        return send(429, { error: { message: 'quota' } });
      }
      return send(200, {
        embeddings: body.requests.map((r: { content: { parts: { text: string }[] } }) => ({
          values: fakeVector(r.content.parts[0].text),
        })),
      });
    }

    // ---- Qdrant ----
    if (url === '/collections/laws' && req.method === 'GET') {
      return send(this.collectionCreated ? 200 : 404, { result: {} });
    }
    if (url === '/collections/laws' && req.method === 'PUT') {
      this.collectionCreated = true;
      return send(200, { result: true });
    }
    if (url === '/collections/laws/index') {
      return send(200, { result: {} });
    }
    if (url.startsWith('/collections/laws/points?') && req.method === 'PUT') {
      for (const point of body.points as FakePoint[]) {
        this.points.set(point.id, point);
      }
      return send(200, { result: {} });
    }
    if (url.startsWith('/collections/laws/points/payload')) {
      for (const point of selected()) {
        Object.assign(point.payload, body.payload);
      }
      return send(200, { result: {} });
    }
    if (url === '/collections/laws/points/count') {
      return send(200, { result: { count: selected().length } });
    }
    if (url === '/collections/laws/points/scroll') {
      return send(200, { result: { points: selected().slice(0, body.limit) } });
    }
    if (url === '/collections/laws/points/query') {
      const hits = selected()
        .map((p) => ({ id: p.id, payload: p.payload, score: cosine(body.query, p.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, body.limit);
      return send(200, { result: { points: hits } });
    }

    send(404, { error: `unexpected request ${req.method} ${url}` });
  }
}

describe('KnowledgeService', () => {
  const law: LawDocument = parseLawXml(
    readFileSync(join(__dirname, 'fixtures', 'sgb3-sample.xml'), 'utf-8'),
  );
  let fake: FakeServices;
  let knowledge: KnowledgeService;

  const createService = async (model: string): Promise<KnowledgeService> => {
    fake = new FakeServices();
    const baseUrl: string = await fake.start();
    const settings: Record<string, string> = {
      GEMINI_API_URL: baseUrl,
      GEMINI_API_KEY: 'test-key',
      GEMINI_EMBEDDING_MODEL: model,
      QDRANT_URL: baseUrl,
      KNOWLEDGE_DB_COLLECTION_NAME: 'laws',
      EMBEDDING_BATCH_SIZE: '2',
      EMBEDDING_PAUSE_MS: '0',
      EMBEDDING_RETRY_WAIT_MS: '1',
    };
    const config = {
      get: (key: string): string | undefined => settings[key],
    } as unknown as ConfigService;
    const clock = { now: (): Date => new Date('2026-11-15T10:00:00Z') } as ClockService;

    return new KnowledgeService(
      config,
      new EmbeddingsClient(config),
      new QdrantClient(config),
      clock,
    );
  };

  beforeEach(async () => {
    knowledge = await createService('models/gemini-embedding-2');
  });

  afterEach(async () => {
    await fake.stop();
  });

  const stored = (): Record<string, unknown>[] =>
    [...fake.points.values()].map((p) => p.payload);

  it('первая загрузка: версия 1, все куски актуальны, поля на месте', async () => {
    const report = await knowledge.ingestLaw(law);

    expect(report).toMatchObject({ status: 'loaded', sourceId: 'sgb-3', version: 1, deactivated: 0 });
    expect(fake.points.size).toBe(report.chunks);
    expect(stored().every((p) => p.active === true && p.version === 1)).toBe(true);
    expect(stored().find((p) => p.chunk_id === 'sgb-3-p142')).toMatchObject({
      source_id: 'sgb-3',
      title: 'SGB 3 § 142 Anwartschaftszeit',
      location: '§ 142',
      stand: 'Zuletzt geändert durch Art. 1a G v. 24.7.2026 I Nr. 228',
      loaded_at: '2026-11-15T10:00:00.000Z',
    });
    expect(fake.receivedApiKey).toBe('test-key');
  });

  it('то же содержимое повторно не загружается', async () => {
    await knowledge.ingestLaw(law);
    const callsAfterFirst: number = fake.embedCalls;

    const report = await knowledge.ingestLaw(law);

    expect(report.status).toBe('unchanged');
    expect(report.version).toBe(1);
    expect(fake.embedCalls).toBe(callsAfterFirst);
  });

  it('новая редакция: старая версия остаётся в базе, но поиск её не видит', async () => {
    await knowledge.ingestLaw(law);
    const firstCount: number = fake.points.size;

    // Имитируем изменение закона: стаж вырос с 12 до 15 месяцев.
    const changed: LawDocument = {
      ...law,
      stand: 'Zuletzt geändert 2027',
      paragraphs: law.paragraphs.map((p) =>
        p.label === '§ 142'
          ? { ...p, blocks: p.blocks.map((b) => b.replace('zwölf Monate in', 'fünfzehn Monate in')) }
          : p,
      ),
    };
    const report = await knowledge.ingestLaw(changed);

    expect(report).toMatchObject({ status: 'loaded', version: 2, deactivated: firstCount });
    expect(fake.points.size).toBe(firstCount * 2);
    expect(stored().filter((p) => p.version === 1).every((p) => p.active === false)).toBe(true);
    expect(stored().filter((p) => p.version === 2).every((p) => p.active === true)).toBe(true);

    const results = await knowledge.search('Anwartschaftszeit', 10);
    expect(results.every((r) => r.chunk.version === 2)).toBe(true);
    expect(results[0].chunk.text).toContain('fünfzehn Monate');
  });

  it('поиск возвращает самый подходящий параграф первым', async () => {
    await knowledge.ingestLaw(law);

    const results = await knowledge.search('Was ist die Rahmenfrist?', 2);

    expect(results).toHaveLength(2);
    expect(results[0].chunk.chunk_id).toBe('sgb-3-p143');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('можно загрузить только часть параграфов', async () => {
    const report = await knowledge.ingestLaw(law, '142-143');

    expect(report.chunks).toBe(2);
    expect(stored().map((p) => p.chunk_id).sort()).toEqual(['sgb-3-p142', 'sgb-3-p143']);
  });

  it('при превышении лимита Gemini ждёт и повторяет запрос', async () => {
    fake.failEmbedTimes = 2;

    const report = await knowledge.ingestLaw(law, '142-143');

    expect(report.status).toBe('loaded');
    expect(fake.embedCalls).toBe(3);
  });

  it('gemini-embedding-2: задача пишется в тексте, поле taskType не шлётся', async () => {
    await knowledge.ingestLaw(law, '143');
    await knowledge.search('Что такое Rahmenfrist?');

    const [document, query] = fake.embedRequests;
    expect(document.text).toMatch(/^title: SGB 3 § 143 Rahmenfrist \| text: Viertes Kapitel/);
    expect(document.taskType).toBeUndefined();
    expect(query.text).toBe('task: question answering | query: Что такое Rahmenfrist?');
    expect(query.taskType).toBeUndefined();
  });

  it('gemini-embedding-001: используется поле taskType, без подсказок в тексте', async () => {
    await fake.stop();
    knowledge = await createService('gemini-embedding-001');

    await knowledge.ingestLaw(law, '143');
    await knowledge.search('Что такое Rahmenfrist?');

    const [document, query] = fake.embedRequests;
    expect(document.taskType).toBe('RETRIEVAL_DOCUMENT');
    expect(document.text).toMatch(/^SGB 3 § 143 Rahmenfrist\n/);
    expect(query).toEqual({ text: 'Что такое Rahmenfrist?', taskType: 'RETRIEVAL_QUERY' });
  });

  it('getChunks: параграф по номеру, длинный параграф всеми частями по порядку', async () => {
    await knowledge.ingestLaw(law);

    const chunks = await knowledge.getChunks(['sgb-3-p143', 'sgb-3-p26']);

    expect(chunks.map((c) => c.chunk_id)).toEqual([
      'sgb-3-p143',
      'sgb-3-p26-1',
      'sgb-3-p26-2',
    ]);
  });

  it('getChunks: неактуальные версии и неизвестные номера не возвращаются', async () => {
    await knowledge.ingestLaw(law, '142-143');
    await knowledge.ingestLaw({ ...law, stand: 'новая редакция' }, '143');

    // § 142 остался только в версии 1, которая теперь неактуальна.
    expect(await knowledge.getChunks(['sgb-3-p142', 'sgb-3-p999'])).toEqual([]);
    expect((await knowledge.getChunks(['sgb-3-p143']))[0].version).toBe(2);
  });

  it('поиск по пустой базе ничего не возвращает и не падает', async () => {
    expect(await knowledge.search('Rahmenfrist')).toEqual([]);
  });

  it('пустой отбор параграфов это ошибка, а не пустая версия', async () => {
    await expect(knowledge.ingestLaw(law, '900-901')).rejects.toThrow(
      'не осталось ни одного параграфа',
    );
  });
});
