import { ConfigService } from '@nestjs/config';
import { AnswerService } from '../answer/answer.service';
import { Answer } from '../answer/types/answer';
import { ClockService } from '../clock/clock.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { RulesService } from '../rules/rules.service';
import { SessionService } from '../session/session.service';
import { ConversationService } from './conversation.service';
import { BotReply } from './types/bot-reply';

/** Тесты идут по настоящим data/questionnaire.json и data/rules.json. */
describe('ConversationService', () => {
  const CHAT: string = 'chat-1';
  let now: number;
  let sessions: SessionService;
  /** Что ядро спросило у базы знаний: вопрос и закреплённые куски. */
  let asked: { question: string; chunks: string[] }[];
  let conversation: ConversationService;

  beforeEach(() => {
    now = Date.UTC(2025, 6, 10, 9, 0, 0); // 10.07.2025
    const clock = { now: (): Date => new Date(now) } as ClockService;
    const config = { get: (): undefined => undefined } as unknown as ConfigService;

    sessions = new SessionService(config, clock);
    // Вместо настоящего RAG стоит заглушка: ядру важно только, что спросили.
    asked = [];
    const answers = {
      answer: async (question: string, chunks: string[] = []): Promise<Answer> => {
        asked.push({ question, chunks });
        const answer: Answer = new Answer();
        answer.status = 'answered';
        answer.text = `ОТВЕТ НА: ${question}`;
        return answer;
      },
    } as unknown as AnswerService;

    conversation = new ConversationService(
      new QuestionnaireService(config),
      new RulesService(config),
      sessions,
      clock,
      answers,
    );
  });

  const say = (text: string): Promise<BotReply> =>
    conversation.handleMessage(CHAT, text);
  const allText = (reply: BotReply): string => reply.messages.join('\n');

  it('начинает с плашки и не идёт дальше без «Окей»', async () => {
    const first: BotReply = await say('привет');
    expect(allText(first)).toContain('не юридическая консультация');
    expect(first.options).toEqual(['Окей']);

    const second: BotReply = await say('расскажи про визу');
    expect(allText(second)).toContain('Выбери, пожалуйста');
    expect(second.options).toEqual(['Окей']);
  });

  it('недавно уволили, стажа не хватает', async () => {
    await say('/start');
    const status: BotReply = await say('Окей');
    expect(status.options).toHaveLength(4);

    await say('Недавно уволили, ничего не получаю');
    await say('02.07.2025');
    const finding: BotReply = await say(
      '15.08.2024 - 30.09.2024\n01.11.2024 - 01.07.2025',
    );

    expect(allText(finding)).toContain('Не хватает 70 дн.');
    expect(allText(finding)).toContain('примерно 3 мес.');
    expect(allText(finding)).toContain('§ 142');
    expect(allText(finding)).toContain('решение принимает Arbeitsagentur');
  });

  it('работающий человек: считаем, как если бы работа закончилась завтра', async () => {
    await say('/start');
    await say('1');
    const intro: BotReply = await say('Работаю');
    expect(allText(intro)).toContain('закончилась завтра');

    const finding: BotReply = await say('01.07.2024 - сейчас');
    expect(allText(finding)).toContain('условие выполнено');
  });

  it('после находки бот сам предлагает темы, а не обрывает разговор', async () => {
    await say('/start');
    await say('Окей');
    await say('Работаю');
    const more: BotReply = await say('нет');

    expect(allText(more)).toContain('о чём часто не знают');
    expect(more.options).toEqual([
      'Сколько месяцев платят пособие',
      'Когда и как встать на учёт',
      'Учёба за счёт агентства',
      'Если уволился сам',
      'Закончить',
    ]);
    expect(more.finished).toBe(false);
  });

  it('кнопка темы: в базу знаний уходит заготовленный вопрос и нужные параграфы', async () => {
    await say('/start');
    await say('Окей');
    await say('Работаю');
    await say('нет');

    const reply: BotReply = await say('Сколько месяцев платят пособие');

    expect(asked).toEqual([
      {
        question: 'Сколько месяцев платят Arbeitslosengeld и от чего зависит этот срок?',
        chunks: ['sgb-3-p147'],
      },
    ]);
    expect(reply.messages[0]).toContain('ОТВЕТ НА:');
    expect(reply.messages[1]).toContain('Что ещё рассказать?');
    expect(reply.options).toHaveLength(5);
  });

  it('свой вопрос уходит в базу знаний как есть, без закреплённых параграфов', async () => {
    await say('/start');
    await say('Окей');
    await say('Работаю');
    await say('нет');

    await say('а я могу ещё на что-то рассчитывать?');
    await say('а если я болею?');

    expect(asked).toEqual([
      { question: 'а я могу ещё на что-то рассчитывать?', chunks: [] },
      { question: 'а если я болею?', chunks: [] },
    ]);
    // Разговор продолжается, ответы человека пока в памяти.
    expect(sessions.get(CHAT)).toBeDefined();
  });

  it('ответы стираются, когда человек нажимает «Закончить»', async () => {
    await say('/start');
    await say('Окей');
    await say('Работаю');
    await say('нет');
    const end: BotReply = await say('Закончить');

    expect(sessions.get(CHAT)).toBeUndefined();
    expect(end.finished).toBe(true);
    // Конец разговора сам переписку не стирает: человеку нужен результат.
    expect(end.eraseChat).toBe(false);
  });

  it('непонятные даты: бот объясняет и повторяет вопрос', async () => {
    await say('/start');
    await say('Окей');
    await say('4');

    const badDate: BotReply = await say('в июле');
    expect(allText(badDate)).toContain('Не смог разобрать дату');
    // Вопрос не повторяется целиком: только объяснение.
    expect(badDate.messages).toHaveLength(1);

    const future: BotReply = await say('01.01.2030');
    expect(allText(future)).toContain('ещё не наступила');

    await say('02.07.2025');
    const badPeriod: BotReply = await say('с августа по сентябрь');
    expect(allText(badPeriod)).toContain('Не смог разобрать строку');
  });

  it('понимает даты, написанные по-человечески', async () => {
    await say('/start');
    await say('Окей');
    await say('Недавно уволили, ничего не получаю');

    const date: BotReply = await say('2 июля этого года');
    expect(allText(date)).toContain('Записал дату: 02.07.2025.');

    const finding: BotReply = await say(
      'с 15 августа 2024 по 30 сентября 2024\n1.11.24 — 1 июля',
    );
    expect(allText(finding)).toContain('15.08.2024 - 30.09.2024');
    expect(allText(finding)).toContain('01.11.2024 - 01.07.2025');
    expect(allText(finding)).toContain('Не хватает 70 дн.');
  });

  it('только начало работы: бот подставляет конец и переспрашивает кнопками', async () => {
    await say('/start');
    await say('Окей');
    await say('Недавно уволили, ничего не получаю');
    await say('2 июля');

    const ask: BotReply = await say('с 1 июля 24 года');
    expect(allText(ask)).toContain('01.07.2024 - 01.07.2025');
    expect(allText(ask)).toContain('последний день перед тем, как ты остался без работы');
    expect(ask.options).toEqual(['Да, верно', 'Нет, напишу иначе']);

    const finding: BotReply = await say('Да, верно');
    expect(allText(finding)).toContain('условие выполнено');
  });

  it('«Нет, напишу иначе» возвращает к вводу периодов, предположение не сохраняется', async () => {
    await say('/start');
    await say('Окей');
    await say('Недавно уволили, ничего не получаю');
    await say('2 июля');
    await say('с 1 июля 24 года');

    const retry: BotReply = await say('Нет, напишу иначе');
    expect(allText(retry)).toContain('напиши начало и конец');
    expect(sessions.get(CHAT)?.answers['jobs']).toBeUndefined();

    const finding: BotReply = await say('01.07.2024 - 15.08.2024');
    expect(allText(finding)).toContain('Не хватает');
  });

  it('вместо кнопки можно сразу написать период по-другому', async () => {
    await say('/start');
    await say('Окей');
    await say('Недавно уволили, ничего не получаю');
    await say('2 июля');
    await say('с 1 июля 24 года');

    const finding: BotReply = await say('01.07.2024 - 15.08.2024');
    expect(allText(finding)).toContain('01.07.2024 - 15.08.2024');
    expect(allText(finding)).toContain('Не хватает');
  });

  it('работающий человек: одно начало означает «работаю до сих пор»', async () => {
    await say('/start');
    await say('Окей');
    await say('Работаю');

    const ask: BotReply = await say('с 1 марта 2025');
    expect(allText(ask)).toContain('01.03.2025 - 10.07.2025');
    expect(allText(ask)).toContain('работаешь там до сих пор');
  });

  it('«Забудь всё» сначала переспрашивает, потом стирает', async () => {
    await say('/start');
    await say('Окей');
    await say('Недавно уволили, ничего не получаю');
    await say('02.07.2025');

    const confirm: BotReply = await say('Забудь всё');
    expect(allText(confirm)).toContain('Точно стереть');
    expect(confirm.options).toEqual(['Да, стереть', 'Нет, продолжим']);
    expect(sessions.get(CHAT)).toBeDefined();

    const done: BotReply = await say('Да, стереть');
    expect(allText(done)).toContain('стёр твои ответы');
    expect(done.finished).toBe(true);
    expect(done.eraseChat).toBe(true);
    expect(sessions.get(CHAT)).toBeUndefined();
  });

  it('отказ от стирания возвращает к тому же вопросу', async () => {
    await say('/start');
    await say('Окей');
    await say('Недавно уволили, ничего не получаю');
    await say('/forget');

    const back: BotReply = await say('Нет, продолжим');
    expect(allText(back)).toContain('ничего не стираю');
    expect(allText(back)).toContain('С какого дня ты без работы');

    // Ответ, данный до этого, не потерялся: разговор идёт дальше.
    const next: BotReply = await say('02.07.2025');
    expect(allText(next)).toContain('Перечисли места работы');
  });

  it('«Забудь всё» без разговора честно говорит, что стирать нечего', async () => {
    const reply: BotReply = await say('Забудь всё');

    expect(allText(reply)).toContain('память уже пуста');
    expect(reply.finished).toBe(true);
    // Ответов нет, но оболочка всё равно может убрать переписку с экрана.
    expect(reply.eraseChat).toBe(true);
  });

  it('«Начать заново» и /start начинают с плашки в любой момент', async () => {
    await say('/start');
    await say('Окей');

    const again: BotReply = await say('Начать заново');
    expect(again.options).toEqual(['Окей']);
    expect(again.finished).toBe(false);
  });

  it('после часа тишины разговор начинается заново', async () => {
    await say('/start');
    await say('Окей');
    now += 61 * 60 * 1000;

    const reply: BotReply = await say('Работаю');
    expect(reply.options).toEqual(['Окей']);
  });

  it('слишком длинное сообщение не обрабатывается', async () => {
    await say('/start');
    const reply: BotReply = await say('а'.repeat(1001));

    expect(allText(reply)).toContain('слишком длинное');
  });
});
