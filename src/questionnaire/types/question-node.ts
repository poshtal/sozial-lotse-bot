/**
 * Узлы дерева вопросов. Само дерево лежит в data/questionnaire.json:
 * новый вопрос или ветка добавляются правкой файла, без изменения кода.
 */

export interface ChoiceOption {
  id: string;
  label: string;
  next: string;
}

/** Вопрос с кнопками. */
export interface ChoiceNode {
  type: 'choice';
  text: string;
  options: ChoiceOption[];
  saveAs?: string;
}

/** Вопрос, на который отвечают датой. */
export interface DateNode {
  type: 'date';
  text: string;
  saveAs: string;
  next: string;
}

/** Вопрос, на который отвечают списком периодов работы. */
export interface PeriodsNode {
  type: 'periods';
  text: string;
  saveAs: string;
  next: string;
}

/** Находка: бот применяет правило и сообщает результат. */
export interface FindingNode {
  type: 'finding';
  rule: 'anwartschaftszeit';
  /** Из какого ответа брать периоды работы. */
  periodsFrom: string;
  /** Из какого ответа брать первый день без работы. Нет ответа: завтра. */
  referenceFrom: string;
  fulfilled: string;
  missing: string;
  next: string;
}

/** Сообщение без вопроса. */
export interface MessageNode {
  type: 'message';
  text: string;
  next: string;
}

/** Конец разговора. */
export interface EndNode {
  type: 'end';
  text: string;
}

export type QuestionNode =
  | ChoiceNode
  | DateNode
  | PeriodsNode
  | FindingNode
  | MessageNode
  | EndNode;

export interface QuestionTree {
  start: string;
  nodes: Record<string, QuestionNode>;
}
