import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Документ для вектора: заголовок отдельно, текст отдельно. */
export class EmbeddingDocument {
  title: string;
  text: string;
}

/** Один запрос к модели: текст и, для старых моделей, тип задачи. */
interface EmbeddingInput {
  text: string;
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
}

/**
 * Превращает текст в вектор (эмбеддинг) через Gemini API.
 *
 * Документы и вопросы обязаны проходить через одну и ту же модель,
 * иначе их векторы нельзя сравнивать. Название модели берётся из .env.
 *
 * Модели узнают, что перед ними (документ или вопрос), по-разному:
 * - gemini-embedding-2 ждёт подсказку прямо в тексте:
 *   документ "title: ... | text: ...", вопрос "task: question answering | query: ..."
 * - более старые модели (gemini-embedding-001) ждут отдельное поле taskType.
 * Источник: https://ai.google.dev/gemini-api/docs/embeddings
 */
@Injectable()
export class EmbeddingsClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly batchSize: number;
  private readonly pauseMs: number;
  private readonly retryWaitMs: number;
  private readonly maxRetries: number = 8;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('GEMINI_API_URL') ??
      'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    // В .env модель может быть записана как "models/xxx" или просто "xxx".
    this.model = (
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ?? ''
    ).replace(/^models\//, '');
    this.batchSize = Number(
      this.configService.get<string>('EMBEDDING_BATCH_SIZE') ?? 10,
    );
    this.pauseMs = Number(
      this.configService.get<string>('EMBEDDING_PAUSE_MS') ?? 2000,
    );
    this.retryWaitMs = Number(
      this.configService.get<string>('EMBEDDING_RETRY_WAIT_MS') ?? 30000,
    );
  }

  getModelName(): string {
    return this.model;
  }

  /** Векторы для кусков текста. Идёт порциями, чтобы не упереться в лимит. */
  async embedDocuments(
    documents: EmbeddingDocument[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<number[][]> {
    const inputs: EmbeddingInput[] = documents.map(
      (document: EmbeddingDocument): EmbeddingInput =>
        this.usesPromptPrefixes()
          ? { text: `title: ${document.title || 'none'} | text: ${document.text}` }
          : {
              text: `${document.title}\n${document.text}`,
              taskType: 'RETRIEVAL_DOCUMENT',
            },
    );
    const vectors: number[][] = [];

    for (let start: number = 0; start < inputs.length; start += this.batchSize) {
      vectors.push(
        ...(await this.embedBatch(inputs.slice(start, start + this.batchSize))),
      );
      onProgress?.(vectors.length, inputs.length);

      if (start + this.batchSize < inputs.length) {
        await this.sleep(this.pauseMs);
      }
    }

    return vectors;
  }

  /** Вектор для вопроса человека. */
  async embedQuery(question: string): Promise<number[]> {
    const input: EmbeddingInput = this.usesPromptPrefixes()
      ? { text: `task: question answering | query: ${question}` }
      : { text: question, taskType: 'RETRIEVAL_QUERY' };

    return (await this.embedBatch([input]))[0];
  }

  /** gemini-embedding-2 и новее не принимают taskType: задача пишется в тексте. */
  private usesPromptPrefixes(): boolean {
    return /^gemini-embedding-(?!001)/.test(this.model);
  }

  private async embedBatch(inputs: EmbeddingInput[]): Promise<number[][]> {
    this.assertConfigured();

    const body: string = JSON.stringify({
      requests: inputs.map((input: EmbeddingInput) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text: input.text }] },
        ...(input.taskType ? { taskType: input.taskType } : {}),
      })),
    });

    for (let attempt: number = 1; ; attempt++) {
      const response: Response = await fetch(
        `${this.apiUrl}/models/${this.model}:batchEmbedContents`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body,
        },
      );

      if (response.ok) {
        const data = (await response.json()) as {
          embeddings: { values: number[] }[];
        };

        if (data.embeddings?.length !== inputs.length) {
          throw new Error('Gemini returned an unexpected number of embeddings');
        }

        return data.embeddings.map((e) => e.values);
      }

      // 429: превышен лимит запросов, 503: сервис перегружен. Ждём и пробуем снова.
      const isTemporary: boolean =
        response.status === 429 || response.status === 503;

      if (!isTemporary || attempt >= this.maxRetries) {
        throw new Error(
          `Gemini embeddings request failed: ${response.status} ${await this.readError(response)}`,
        );
      }

      await this.sleep(this.retryWaitMs);
    }
  }

  private assertConfigured(): void {
    if (this.apiKey === '' || this.model === '') {
      throw new Error(
        'GEMINI_API_KEY and GEMINI_EMBEDDING_MODEL should be set in .env',
      );
    }
  }

  /** Короткий текст ошибки от Gemini. Ключ в него не попадает. */
  private async readError(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      return data.error?.message ?? '';
    } catch {
      return '';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve): void => {
      setTimeout(resolve, ms);
    });
  }
}
