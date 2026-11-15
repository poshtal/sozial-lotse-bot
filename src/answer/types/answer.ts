/** Откуда взят ответ: поля те же, что у куска в базе знаний. */
export class AnswerSource {
  source_id: string;
  chunk_id: string;
  title: string;
  location: string;
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
}
