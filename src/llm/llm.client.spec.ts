import { ConfigService } from '@nestjs/config';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { LlmClient } from './llm.client';

/** Настоящий клиент ходит по HTTP в поддельный Gemini, поднятый в тесте. */
describe('LlmClient', () => {
  let server: Server;
  let client: LlmClient;
  let requests: { url: string; key: string; body: Record<string, any> }[];
  let responses: { status: number; body: unknown }[];

  beforeEach(async () => {
    requests = [];
    responses = [];
    server = createServer((req, res) => {
      let raw: string = '';
      req.on('data', (part) => (raw += part));
      req.on('end', () => {
        requests.push({
          url: req.url ?? '',
          key: req.headers['x-goog-api-key'] as string,
          body: JSON.parse(raw),
        });
        const next = responses.shift() ?? { status: 500, body: {} };
        res.writeHead(next.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(next.body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const settings: Record<string, string> = {
      GEMINI_API_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      GEMINI_API_KEY: 'test-key',
      GEMINI_GENERATION_MODEL: 'models/gemini-test',
      LLM_RETRY_WAIT_MS: '1',
    };
    client = new LlmClient({
      get: (key: string): string | undefined => settings[key],
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const ok = (parts: object[]): { status: number; body: unknown } => ({
    status: 200,
    body: { candidates: [{ content: { role: 'model', parts } }] },
  });

  it('шлёт правила и данные раздельно и просит JSON', async () => {
    responses.push(ok([{ text: '{"answered": true}' }]));

    const text: string = await client.generateJson('ПРАВИЛА', 'ДАННЫЕ');

    expect(text).toBe('{"answered": true}');
    expect(requests[0].url).toBe('/models/gemini-test:generateContent');
    expect(requests[0].key).toBe('test-key');
    expect(requests[0].body.systemInstruction.parts[0].text).toBe('ПРАВИЛА');
    expect(requests[0].body.contents[0].parts[0].text).toBe('ДАННЫЕ');
    expect(requests[0].body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('пропускает части с размышлениями модели', async () => {
    responses.push(ok([{ text: 'думаю...', thought: true }, { text: '{"a":' }, { text: '1}' }]));

    expect(await client.generateJson('s', 'u')).toBe('{"a":1}');
  });

  it('при перегрузке ждёт и повторяет запрос', async () => {
    responses.push({ status: 503, body: {} }, { status: 429, body: {} }, ok([{ text: '{}' }]));

    expect(await client.generateJson('s', 'u')).toBe('{}');
    expect(requests).toHaveLength(3);
  });

  it('после трёх неудач сдаётся, ключ в ошибку не попадает', async () => {
    responses.push({ status: 503, body: {} }, { status: 503, body: {} }, { status: 503, body: {} });

    await expect(client.generateJson('s', 'u')).rejects.toThrow(/failed: 503$/);
  });

  it('пустой ответ модели это ошибка, а не пустое сообщение человеку', async () => {
    responses.push({ status: 200, body: { candidates: [] } });

    await expect(client.generateJson('s', 'u')).rejects.toThrow('empty answer');
  });

  it('при исчерпанном лимите называет, какой лимит кончился и когда повторить', async () => {
    const limited = {
      status: 429,
      body: {
        error: {
          code: 429,
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
            },
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' },
          ],
        },
      },
    };
    responses.push(limited, limited, limited);

    await expect(client.generateJson('П', 'Д')).rejects.toThrow(
      'Gemini generation request failed: 429 (limit: GenerateRequestsPerDayPerProjectPerModel-FreeTier; retry in 37s)',
    );
  });

  it('если Google не отвечает дольше предела, сдаётся сразу, без повторов', async () => {
    const slow: Server = createServer(() => {
      // Никогда не отвечает.
    });
    await new Promise<void>((resolve) => slow.listen(0, '127.0.0.1', resolve));
    const settings: Record<string, string> = {
      GEMINI_API_URL: `http://127.0.0.1:${(slow.address() as AddressInfo).port}`,
      GEMINI_API_KEY: 'test-key',
      GEMINI_GENERATION_MODEL: 'gemini-test',
      LLM_TIMEOUT_MS: '50',
    };
    const impatient = new LlmClient({
      get: (key: string): string | undefined => settings[key],
    } as unknown as ConfigService);

    try {
      await expect(impatient.generateJson('П', 'Д')).rejects.toThrow('timed out after 50 ms');
    } finally {
      slow.closeAllConnections();
      await new Promise<void>((resolve) => slow.close(() => resolve()));
    }
  });

  it('лёгкие шаги идут в лёгкую модель, ответы в основную', async () => {
    const settings: Record<string, string> = {
      GEMINI_API_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      GEMINI_API_KEY: 'test-key',
      GEMINI_GENERATION_MODEL: 'gemini-main',
      GEMINI_LIGHT_MODEL: 'models/gemini-lite',
    };
    const twoModels = new LlmClient({
      get: (key: string): string | undefined => settings[key],
    } as unknown as ConfigService);
    responses.push(ok([{ text: '{}' }]), ok([{ text: '{}' }]));

    await twoModels.generateJson('П', 'Д', 'light');
    await twoModels.generateJson('П', 'Д');

    expect(requests.map((r) => r.url)).toEqual([
      '/models/gemini-lite:generateContent',
      '/models/gemini-main:generateContent',
    ]);
  });

  it('без GEMINI_LIGHT_MODEL лёгкие шаги идут в основную модель', async () => {
    responses.push(ok([{ text: '{}' }]));

    await client.generateJson('П', 'Д', 'light');

    expect(requests[0].url).toBe('/models/gemini-test:generateContent');
  });
});
