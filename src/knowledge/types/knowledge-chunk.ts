/**
 * Кусок текста, который попадает в базу знаний.
 * Названия полей (source_id, chunk_id, title, location, text) взяты
 * из инструкции к практике, чтобы ответ можно было проследить до источника.
 */
export class KnowledgeChunk {
  /** Источник: "sgb-3". */
  source_id: string;
  /** Устойчивый номер куска: "sgb-3-p142" или "sgb-3-p26-2" для частей. */
  chunk_id: string;
  /** Название источника и параграфа: "SGB 3 § 142 Anwartschaftszeit". */
  title: string;
  /** Место в источнике: "§ 142" или "§ 26 (часть 2 из 3)". */
  location: string;
  /** Глава и раздел закона. */
  section: string;
  /** Текст на немецком, как в законе. */
  text: string;
}

/** То, что хранится в Qdrant рядом с вектором. */
export class StoredChunk extends KnowledgeChunk {
  /** Номер загрузки этого источника: 1, 2, 3... */
  version: number;
  /** true только у последней загруженной версии. Поиск идёт по ней. */
  active: boolean;
  /** Редакция закона на момент загрузки. */
  stand: string;
  /** Отпечаток загруженного содержимого: одинаковое не грузится дважды. */
  content_hash: string;
  /** Когда загружено. */
  loaded_at: string;
}

export class SearchResult {
  /** Насколько кусок похож на вопрос: чем ближе к 1, тем лучше. */
  score: number;
  chunk: StoredChunk;
}
