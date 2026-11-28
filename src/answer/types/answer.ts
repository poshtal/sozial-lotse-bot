/** Откуда взят ответ: поля те же, что у куска в базе знаний. */
export class AnswerSource {
  source_id: string;
  chunk_id: string;
  title: string;
  location: string;
}

/** Один найденный кусок: что нашлось и прошло ли порог. */
export class AnswerTraceResult {
  chunk_id: string;
  title: string;
  score: number;
  passed: boolean;
}

/**
 * Как бот пришёл к ответу: для команды проверки качества (evaluate).
 * Человеку в Telegram не показывается и никуда не пишется.
 */
export class AnswerTrace {
  /** Куски заданы темой заранее, поиск по смыслу не делался. */
  pinned: boolean = false;
  /** Модель сочла вопрос относящимся к теме. */
  inScope: boolean = true;
  /** Чем вопрос не по теме, если inScope false. */
  area?: 'labor_law' | 'other';
  /** Вопрос удалось переписать языком закона. */
  rewritten: boolean = false;
  /** По какому тексту искали. */
  query: string = '';
  results: AnswerTraceResult[] = [];
}

export class Answer {
  /**
   * answered: ответ найден в базе знаний.
   * unknown: в базе нет подходящего текста, бот честно говорит «не умею».
   * failed: модель или база недоступны.
   */
  status: 'answered' | 'unknown' | 'failed';
  /** Готовый текст для человека, вместе с источниками. */
  text: string;
  sources: AnswerSource[] = [];
  /**
   * 2–3 вопроса, которые логично задать дальше, на них есть ответ в тех же
   * кусках закона. Бот показывает их кнопками: человек не знает, что спросить.
   */
  followUps: string[] = [];
  /** Как бот пришёл к ответу. Нет, если сбой случился до поиска. */
  trace?: AnswerTrace;
}
