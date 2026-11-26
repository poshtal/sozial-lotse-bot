import { formatTopicList, visibleTopics } from './topic-filter';
import { AskTopic } from './types/question-node';

const topic = (id: string, showIf?: AskTopic['showIf'], summary?: string): AskTopic => ({
  id,
  label: id,
  question: id,
  showIf,
  summary,
});

describe('visibleTopics', () => {
  const topics: AskTopic[] = [
    topic('all'),
    topic('employed', { status: ['employed'] }),
    topic('alg', { algEligible: true }),
    topic('fired-alg', { status: ['fired'], algEligible: true }),
  ];

  it('без условий тема видна всем, порядок сохраняется', () => {
    const ids = visibleTopics(topics, { status: 'fired', algEligible: true }).map((t) => t.id);

    expect(ids).toEqual(['all', 'alg', 'fired-alg']);
  });

  it('оба условия должны выполняться', () => {
    const ids = visibleTopics(topics, { status: 'fired', algEligible: false }).map((t) => t.id);

    expect(ids).toEqual(['all']);
  });

  it('статус ещё неизвестен: темы со статусом скрыты', () => {
    const ids = visibleTopics(topics, { algEligible: false }).map((t) => t.id);

    expect(ids).toEqual(['all']);
  });
});

describe('formatTopicList', () => {
  it('нумерует пункты и добавляет описание, если оно есть', () => {
    expect(formatTopicList([topic('Курсы', undefined, 'Оплатят обучение.'), topic('Другое')])).toBe(
      '1. Курсы. Оплатят обучение.\n\n2. Другое',
    );
  });
});
