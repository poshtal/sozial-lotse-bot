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
export interface AnwartschaftFindingNode {
  type: 'finding';
  rule: 'anwartschaftszeit';
  /** Из какого ответа брать периоды работы. */
  periodsFrom: string;
  /** Из какого ответа брать первый день без работы. Нет ответа: завтра. */
  referenceFrom: string;
  fulfilled: string;
  missing: string;
  next: string;
  /** Куда идти, если стаж набран. Нет: туда же, куда next. */
  fulfilledNext?: string;
}

/** Срок пособия по § 147. */
export interface AnspruchsdauerFindingNode {
  type: 'finding';
  rule: 'anspruchsdauer';
  periodsFrom: string;
  referenceFrom: string;
  /** Из какого ответа брать возрастную группу (id кнопки). */
  ageFrom: string;
  /** Срок равен максимуму для возраста: число точное. */
  exact: string;
  /** До максимума не хватает работы: возможно, человек работал раньше. */
  belowMax: string;
  next: string;
}

export type FindingNode = AnwartschaftFindingNode | AnspruchsdauerFindingNode;

/** Сообщение без вопроса. */
export interface MessageNode {
  type: 'message';
  text: string;
  next: string;
}

/** Кому показывать тему. Пустое условие: всем. */
export interface TopicCondition {
  /** Только при этих ответах на вопрос «В каком ты положении?». */
  status?: string[];
  /** Только тем, у кого есть право на Arbeitslosengeld: стаж набран или уже получает. */
  algEligible?: boolean;
}

/** Тема, о которой бот предлагает рассказать сам. */
export interface AskTopic {
  id: string;
  /** Подпись кнопки. */
  label: string;
  /** Одна строка для списка «что тебе может быть доступно». */
  summary?: string;
  /** Вопрос, который уходит в базу знаний и модели. */
  question: string;
  /** Номера кусков, которые точно отвечают на вопрос: "sgb-3-p147". */
  chunks?: string[];
  /** Кому показывать. Нет: всем. */
  showIf?: TopicCondition;
}

/**
 * Свободные вопросы: человек выбирает тему кнопкой или пишет свой вопрос,
 * бот отвечает по базе знаний и остаётся на этом же узле.
 *
 * Темы отбираются по ответам человека. Если подошла хоть одна, бот
 * показывает listText со списком; если ни одной, то text.
 */
export interface AskNode {
  type: 'ask';
  text: string;
  /** Текст со списком подходящих тем, на месте {list}. */
  listText?: string;
  /** Что бот пишет после каждого ответа. */
  againText: string;
  topics: AskTopic[];
  /** Подпись кнопки выхода. */
  exitLabel: string;
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
  | AskNode
  | EndNode;

export interface QuestionTree {
  start: string;
  nodes: Record<string, QuestionNode>;
}
