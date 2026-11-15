import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Условие отбора точек в Qdrant. */
export interface QdrantFilter {
  must: (
    | { key: string; match: { value: string | number | boolean } }
    | { key: string; match: { any: string[] } }
    | { key: string; range: { lt?: number; gte?: number } }
  )[];
}

export interface QdrantPoint<T> {
  id: string;
  vector: number[];
  payload: T;
}

export interface QdrantHit<T> {
  id: string;
  score: number;
  payload: T;
}

/**
 * Работа с векторной базой Qdrant через её HTTP API.
 * Без библиотек-обёрток: каждый метод это один понятный запрос.
 */
@Injectable()
export class QdrantClient {
  private readonly url: string;
  private readonly collection: string;

  constructor(private readonly configService: ConfigService) {
    this.url = (
      this.configService.get<string>('QDRANT_URL') ?? 'http://qdrant:6333'
    ).replace(/\/+$/, '');
    this.collection =
      this.configService.get<string>('KNOWLEDGE_DB_COLLECTION_NAME') ?? 'laws';
  }

  async collectionExists(): Promise<boolean> {
    const response: Response = await this.send('GET', '');
    return response.ok;
  }

  /** Создаёт коллекцию под векторы заданной длины, если её ещё нет. */
  async ensureCollection(vectorSize: number): Promise<void> {
    if (await this.collectionExists()) {
      return;
    }

    await this.request('PUT', '', {
      vectors: { size: vectorSize, distance: 'Cosine' },
    });

    // Индексы по полям, по которым идёт отбор.
    await this.request('PUT', '/index', {
      field_name: 'active',
      field_schema: 'bool',
    });
    await this.request('PUT', '/index', {
      field_name: 'source_id',
      field_schema: 'keyword',
    });
    await this.request('PUT', '/index', {
      field_name: 'version',
      field_schema: 'integer',
    });
  }

  async upsert<T>(points: QdrantPoint<T>[]): Promise<void> {
    await this.request('PUT', '/points?wait=true', { points });
  }

  /** Меняет поля у всех точек, подходящих под условие. Векторы не трогает. */
  async setPayload(
    payload: Record<string, unknown>,
    filter: QdrantFilter,
  ): Promise<void> {
    await this.request('POST', '/points/payload?wait=true', { payload, filter });
  }

  /** Возвращает точки по условию, без поиска по смыслу. */
  async scroll<T>(filter: QdrantFilter, limit: number): Promise<QdrantHit<T>[]> {
    const data = (await this.request('POST', '/points/scroll', {
      filter,
      limit,
      with_payload: true,
    })) as { result: { points: QdrantHit<T>[] } };

    return data.result.points;
  }

  async count(filter: QdrantFilter): Promise<number> {
    const data = (await this.request('POST', '/points/count', {
      filter,
      exact: true,
    })) as { result: { count: number } };

    return data.result.count;
  }

  /** Поиск по смыслу: ближайшие к вектору точки, подходящие под условие. */
  async search<T>(
    vector: number[],
    limit: number,
    filter: QdrantFilter,
  ): Promise<QdrantHit<T>[]> {
    const data = (await this.request('POST', '/points/query', {
      query: vector,
      limit,
      filter,
      with_payload: true,
    })) as { result: { points: QdrantHit<T>[] } };

    return data.result.points;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const response: Response = await this.send(method, path, body);

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed: ${method} ${path} -> ${response.status} ${await response.text()}`,
      );
    }

    return response.json();
  }

  private async send(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    try {
      return await fetch(`${this.url}/collections/${this.collection}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error(
        `Нет связи с Qdrant по адресу ${this.url}. Проверь, что контейнер qdrant запущен.`,
      );
    }
  }
}
