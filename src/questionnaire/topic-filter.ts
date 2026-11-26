import { AskTopic, TopicCondition } from './types/question-node';

/** Что о человеке известно из анкеты, нужное для отбора тем. */
export interface TopicContext {
  status?: string;
  algEligible: boolean;
}

/**
 * Оставляет темы, которые подходят человеку. Порядок как в дереве:
 * сверху самое важное.
 */
export function visibleTopics(topics: AskTopic[], context: TopicContext): AskTopic[] {
  return topics.filter((topic: AskTopic): boolean => matches(topic.showIf, context));
}

function matches(condition: TopicCondition | undefined, context: TopicContext): boolean {
  if (!condition) {
    return true;
  }

  if (condition.status && !condition.status.includes(context.status ?? '')) {
    return false;
  }

  if (condition.algEligible !== undefined && condition.algEligible !== context.algEligible) {
    return false;
  }

  return true;
}

/** Нумерованный список для сообщения: «1. Подпись: строка-описание». */
export function formatTopicList(topics: AskTopic[]): string {
  return topics
    .map((topic: AskTopic, index: number): string =>
      topic.summary
        ? `${index + 1}. ${topic.label}. ${topic.summary}`
        : `${index + 1}. ${topic.label}`,
    )
    .join('\n\n');
}
