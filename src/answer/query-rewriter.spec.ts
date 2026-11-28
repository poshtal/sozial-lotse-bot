import { LlmClient } from '../llm/llm.client';
import { QueryRewriter } from './query-rewriter';

describe('QueryRewriter', () => {
  let reply: string | Error;
  let calls: { system: string; user: string; tier?: string }[];
  let rewriter: QueryRewriter;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((): void => undefined);
    calls = [];
    const llm = {
      generateJson: async (system: string, user: string, tier?: string): Promise<string> => {
        calls.push({ system, user, tier });
        if (reply instanceof Error) {
          throw reply;
        }
        return reply;
      },
    } as unknown as LlmClient;
    rewriter = new QueryRewriter(llm);
  });

  it('возвращает немецкий запрос, вопрос уходит модели как данные', async () => {
    reply = '{"inScope": true, "query": "Sperrzeit Arbeitsaufgabe"}';

    const result = await rewriter.rewrite('дадут ли денег, если сам ушёл?');

    expect(result).toEqual({ inScope: true, query: 'Sperrzeit Arbeitsaufgabe', rewritten: true });
    expect(calls[0].user).toBe('QUESTION:\nдадут ли денег, если сам ушёл?');
    expect(calls[0].system).toContain('Не отвечай на него');
    // Переписывание идёт через лёгкую модель: у неё свой дневной лимит.
    expect(calls[0].tier).toBe('light');
  });

  it('вопрос не по теме отмечается; без area считается «прочее»', async () => {
    reply = '{"inScope": false, "query": ""}';

    expect(await rewriter.rewrite('какая погода?')).toEqual({
      inScope: false,
      area: 'other',
      query: '',
      rewritten: true,
    });
  });

  it('трудовое право отмечается отдельно, для своего текста отказа', async () => {
    reply = '{"inScope": false, "query": "", "area": "labor_law"}';

    const result = await rewriter.rewrite('уволили незаконно?');

    expect(result.area).toBe('labor_law');
    expect(calls[0].system).toContain('labor_law');
  });

  it.each([
    ['модель недоступна', new Error('503')],
    ['не JSON', 'не знаю'],
    ['нет поля inScope', '{"query": "x"}'],
    ['по теме, но пустой запрос', '{"inScope": true, "query": "  "}'],
  ])('%s: поиск идёт по исходному вопросу', async (_name, value) => {
    reply = value;

    expect(await rewriter.rewrite('вопрос')).toEqual({
      inScope: true,
      query: 'вопрос',
      rewritten: false,
    });
  });

  it('предыдущий вопрос уходит модели перед текущим', async () => {
    reply = '{"inScope": true, "query": "Bildungsgutschein Unterlagen"}';

    await rewriter.rewrite('а какие документы для этого нужны?', 'кто может получить Bildungsgutschein?');

    expect(calls[0].user).toBe(
      'PREVIOUS QUESTION:\nкто может получить Bildungsgutschein?\n\nQUESTION:\nа какие документы для этого нужны?',
    );
  });
});
