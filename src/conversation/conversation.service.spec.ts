import { ConfigService } from '@nestjs/config';
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
  let conversation: ConversationService;

  beforeEach(() => {
    now = Date.UTC(2025, 6, 10, 9, 0, 0); // 10.07.2025
    const clock = { now: (): Date => new Date(now) } as ClockService;
    const config = { get: (): undefined => undefined } as unknown as ConfigService;

    sessions = new SessionService(config, clock);
    conversation = new ConversationService(
      new QuestionnaireService(config),
      new RulesService(config),
      sessions,
      clock,
    );
  });

  const say = (text: string): BotReply => conversation.handleMessage(CHAT, text);
  const allText = (reply: BotReply): string => reply.messages.join('\n');

  it('начинает с плашки и не идёт дальше без «Окей»', () => {
    const first: BotReply = say('привет');
    expect(allText(first)).toContain('не юридическая консультация');
    expect(first.options).toEqual(['Окей']);

    const second: BotReply = say('расскажи про визу');
    expect(allText(second)).toContain('Выбери, пожалуйста');
    expect(second.options).toEqual(['Окей']);
  });

  it('история автора: недавно уволили, стажа не хватает', () => {
    say('/start');
    const status: BotReply = say('Окей');
    expect(status.options).toHaveLength(4);

    say('Недавно уволили, ничего не получаю');
    say('02.07.2025');
    const finding: BotReply = say(
      '15.08.2024 - 30.09.2024\n01.11.2024 - 01.07.2025',
    );

    expect(allText(finding)).toContain('Не хватает 70 дн.');
    expect(allText(finding)).toContain('примерно 3 мес.');
    expect(allText(finding)).toContain('§ 142');
    expect(allText(finding)).toContain('решение принимает Arbeitsagentur');
  });

  it('работающий человек: считаем, как если бы работа закончилась завтра', () => {
    say('/start');
    say('1');
    const intro: BotReply = say('Работаю');
    expect(allText(intro)).toContain('закончилась завтра');

    const finding: BotReply = say('01.07.2024 - сейчас');
    expect(allText(finding)).toContain('условие выполнено');
  });

  it('ответы стираются в конце разговора', () => {
    say('/start');
    say('Окей');
    say('Работаю');
    say('нет');

    expect(sessions.get(CHAT)).toBeUndefined();
  });

  it('непонятные даты: бот объясняет и повторяет вопрос', () => {
    say('/start');
    say('Окей');
    say('4');

    const badDate: BotReply = say('в июле');
    expect(allText(badDate)).toContain('ДД.ММ.ГГГГ');

    const future: BotReply = say('01.01.2030');
    expect(allText(future)).toContain('ещё не наступила');

    say('02.07.2025');
    const badPeriod: BotReply = say('с августа по сентябрь');
    expect(allText(badPeriod)).toContain('Не смог разобрать строку');
  });

  it('«Забудь всё» стирает ответы в любой момент', () => {
    say('/start');
    say('Окей');
    say('Недавно уволили, ничего не получаю');
    say('02.07.2025');

    const reply: BotReply = say('Забудь всё');
    expect(allText(reply)).toContain('стёр твои ответы');
    expect(sessions.get(CHAT)).toBeUndefined();
  });

  it('после часа тишины разговор начинается заново', () => {
    say('/start');
    say('Окей');
    now += 61 * 60 * 1000;

    const reply: BotReply = say('Работаю');
    expect(reply.options).toEqual(['Окей']);
  });

  it('слишком длинное сообщение не обрабатывается', () => {
    say('/start');
    const reply: BotReply = say('а'.repeat(1001));

    expect(allText(reply)).toContain('слишком длинное');
  });
});
