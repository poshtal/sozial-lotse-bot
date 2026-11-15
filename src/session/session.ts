/** Ответ, который бот понял с предположением и ждёт подтверждения. */
export class PendingAnswer {
  /** Под каким ключом сохранить ответ после «Да». */
  saveAs: string;
  /** Куда идти после «Да». */
  next: string;
  value: unknown;
}

/** Всё, что бот помнит об одном разговоре. Живёт только в памяти программы. */
export class Session {
  /** На каком узле дерева остановился разговор. */
  nodeId: string;
  /** Ответы человека: ключ это saveAs из дерева вопросов. */
  answers: Record<string, unknown> = {};
  /** Бот спросил «Точно стереть?» и ждёт ответа. */
  confirmingForget: boolean = false;
  /** Ответ, ожидающий подтверждения «Да, верно». */
  pendingAnswer?: PendingAnswer;
  /** Время последнего сообщения, миллисекунды. */
  lastActivity: number;
}
