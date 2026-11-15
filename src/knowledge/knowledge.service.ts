import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ClockService } from '../clock/clock.service';
import { chunkLaw, textForEmbedding } from './chunker';
import { EmbeddingsClient } from './embeddings.client';
import { createParagraphFilter } from './paragraph-filter';
import { QdrantClient, QdrantFilter, QdrantHit, QdrantPoint } from './qdrant.client';
import {
  KnowledgeChunk,
  SearchResult,
  StoredChunk,
} from './types/knowledge-chunk';
import { LawDocument } from './types/law-document';

export class IngestReport {
  /** loaded: загружена новая версия. unchanged: такое содержимое уже в базе. */
  status: 'loaded' | 'unchanged';
  sourceId: string;
  version: number;
  chunks: number;
  /** Сколько кусков прежних версий помечено неактуальными. */
  deactivated: number;
}

const UPSERT_BATCH_SIZE: number = 50;
/** На сколько частей самое большее делится один параграф. */
const MAX_PARTS: number = 9;

/**
 * База знаний: загрузка законов и поиск по ним.
 *
 * Загрузка доступна только из локального скрипта (src/ingest.ts).
 * У бота нет ни команды, ни адреса, через которые можно что-то добавить.
 */
@Injectable()
export class KnowledgeService {
  private readonly topK: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly embeddings: EmbeddingsClient,
    private readonly qdrant: QdrantClient,
    private readonly clock: ClockService,
  ) {
    this.topK = Number(this.configService.get<string>('TOP_K_VALUE') ?? 3);
  }

  /**
   * Загружает закон как новую версию источника.
   * Прежние версии не удаляются: они остаются в базе с active = false,
   * и поиск их не видит.
   */
  async ingestLaw(
    law: LawDocument,
    paragraphs?: string,
    log: (message: string) => void = (): void => undefined,
  ): Promise<IngestReport> {
    const keep: (label: string) => boolean = createParagraphFilter(paragraphs);
    const chunks: KnowledgeChunk[] = chunkLaw({
      ...law,
      paragraphs: law.paragraphs.filter((p) => keep(p.label)),
    });

    if (chunks.length === 0) {
      throw new Error('После отбора не осталось ни одного параграфа');
    }

    const sourceId: string = chunks[0].source_id;
    const contentHash: string = this.hashContent(chunks);
    const current: StoredChunk | undefined = await this.findActive(sourceId);

    const report: IngestReport = new IngestReport();
    report.sourceId = sourceId;
    report.chunks = chunks.length;
    report.deactivated = 0;

    // Ровно это содержимое уже загружено и актуально: делать нечего.
    if (current?.content_hash === contentHash) {
      report.status = 'unchanged';
      report.version = current.version;
      return report;
    }

    const version: number = (current?.version ?? 0) + 1;
    log(`Кусков: ${chunks.length}. Строю векторы (модель ${this.embeddings.getModelName()})...`);

    const vectors: number[][] = await this.embeddings.embedDocuments(
      chunks.map((chunk: KnowledgeChunk) => ({
        title: chunk.title,
        text: textForEmbedding(chunk),
      })),
      (done: number, total: number): void => log(`  векторы: ${done} из ${total}`),
    );

    await this.qdrant.ensureCollection(vectors[0].length);

    const loadedAt: string = this.clock.now().toISOString();
    const points: QdrantPoint<StoredChunk>[] = chunks.map(
      (chunk: KnowledgeChunk, index: number): QdrantPoint<StoredChunk> => ({
        id: this.pointId(sourceId, version, chunk.chunk_id),
        vector: vectors[index],
        payload: {
          ...chunk,
          version,
          active: true,
          stand: law.stand,
          content_hash: contentHash,
          loaded_at: loadedAt,
        },
      }),
    );

    log('Сохраняю в Qdrant...');
    for (let start: number = 0; start < points.length; start += UPSERT_BATCH_SIZE) {
      await this.qdrant.upsert(points.slice(start, start + UPSERT_BATCH_SIZE));
    }

    // Прежние версии этого источника остаются в базе, но становятся неактуальными.
    const olderVersions: QdrantFilter = {
      must: [
        { key: 'source_id', match: { value: sourceId } },
        { key: 'version', range: { lt: version } },
        { key: 'active', match: { value: true } },
      ],
    };
    report.deactivated = await this.qdrant.count(olderVersions);

    if (report.deactivated > 0) {
      await this.qdrant.setPayload({ active: false }, olderVersions);
    }

    report.status = 'loaded';
    report.version = version;
    return report;
  }

  /** Ищет куски закона, близкие по смыслу к вопросу. Только актуальная версия. */
  async search(question: string, limit: number = this.topK): Promise<SearchResult[]> {
    if (!(await this.qdrant.collectionExists())) {
      return [];
    }

    const vector: number[] = await this.embeddings.embedQuery(question);
    const hits: QdrantHit<StoredChunk>[] = await this.qdrant.search<StoredChunk>(
      vector,
      limit,
      { must: [{ key: 'active', match: { value: true } }] },
    );

    return hits.map((hit: QdrantHit<StoredChunk>): SearchResult => {
      const result: SearchResult = new SearchResult();
      result.score = hit.score;
      result.chunk = hit.payload;
      return result;
    });
  }

  /**
   * Достаёт куски по их номерам, без поиска по смыслу. Нужен для тем,
   * где заранее известно, какой параграф отвечает на вопрос.
   *
   * Длинный параграф лежит в базе частями ("sgb-3-p81-1", "sgb-3-p81-2"),
   * поэтому по номеру "sgb-3-p81" возвращаются все его части по порядку.
   */
  async getChunks(chunkIds: string[]): Promise<StoredChunk[]> {
    if (chunkIds.length === 0 || !(await this.qdrant.collectionExists())) {
      return [];
    }

    const withParts: string[] = chunkIds.flatMap((id: string): string[] => [
      id,
      ...Array.from({ length: MAX_PARTS }, (_, i: number): string => `${id}-${i + 1}`),
    ]);

    const hits: QdrantHit<StoredChunk>[] = await this.qdrant.scroll<StoredChunk>(
      {
        must: [
          { key: 'active', match: { value: true } },
          { key: 'chunk_id', match: { any: withParts } },
        ],
      },
      withParts.length,
    );

    // Порядок как в запросе: сначала первая тема, внутри неё части по номерам.
    return hits
      .map((hit: QdrantHit<StoredChunk>): StoredChunk => hit.payload)
      .sort(
        (a: StoredChunk, b: StoredChunk): number =>
          withParts.indexOf(a.chunk_id) - withParts.indexOf(b.chunk_id),
      );
  }

  private async findActive(sourceId: string): Promise<StoredChunk | undefined> {
    if (!(await this.qdrant.collectionExists())) {
      return undefined;
    }

    const hits: QdrantHit<StoredChunk>[] = await this.qdrant.scroll<StoredChunk>(
      {
        must: [
          { key: 'source_id', match: { value: sourceId } },
          { key: 'active', match: { value: true } },
        ],
      },
      1,
    );

    return hits[0]?.payload;
  }

  /** Отпечаток содержимого: меняется, если изменился хоть один кусок. */
  private hashContent(chunks: KnowledgeChunk[]): string {
    const hash = createHash('sha256');

    for (const chunk of chunks) {
      hash.update(`${chunk.chunk_id}\n${chunk.title}\n${chunk.text}\n\n`);
    }

    return hash.digest('hex');
  }

  /**
   * Qdrant требует номер точки в виде UUID. Делаем его из источника,
   * версии и номера куска: повторная загрузка той же версии
   * перезаписывает те же точки, а не плодит копии.
   */
  private pointId(sourceId: string, version: number, chunkId: string): string {
    const hex: string = createHash('sha256')
      .update(`${sourceId}:${version}:${chunkId}`)
      .digest('hex');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }
}
