import { ConfigService } from '@nestjs/config';
import { Bot } from 'grammy';
import { ClockService } from '../clock/clock.service';
import { ConversationService } from '../conversation/conversation.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { RulesService } from '../rules/rules.service';
import { SessionService } from '../session/session.service';
import { RATE_LIMIT_MAX_MESSAGES } from './constants/telegram.constants';
import { RateLimiter } from './rate-limiter';
import { TelegramRunner } from './telegram.runner';

/** Что бот отправил в Telegram: текст и подписи кнопок. */
interface SentMessage {
  chatId: number;
  text: string;
  buttons: string[];
}

/**
 * Настоящий бот с настоящими обработчиками, но без сети: вместо запросов
 * к Telegram стоит перехватчик, который записывает отправленные сообщения.
 */
describe('TelegramRunner', () => {
  const CHAT_ID: number = 111;
  let now: number;
  let bot: Bot;
  let sent: SentMessage[];
  let updateId: number;

  beforeEach(() => {
    now = Date.UTC(2025, 6, 10, 9, 0, 0);
    updateId = 0;
    sent = [];

    const clock = { now: (): Date => new Date(now) } as ClockService;
    const config = { get: (): undefined => undefined } as unknown as ConfigService;
    const conversation = new ConversationService(
      new QuestionnaireService(config),
      new RulesService(config),
      new SessionService(config, clock),
      clock,
    );
    const runner = new TelegramRunner(config, conversation, new RateLimiter(clock));

    bot = runner.createBot('test-token', {
      botInfo: {
        id: 1,
        is_bot: true,
        first_name: 'Test',
        username: 'test_bot',
      } as never,
    });

    bot.api.config.use(async (_prev, method, payload) => {
      if (method === 'sendMessage') {
        const p = payload as {
          chat_id: number;
          text: string;
          reply_markup?: { keyboard?: { text: string }[][] };
        };
        sent.push({
          chatId: p.chat_id,
          text: p.text,
          buttons: (p.reply_markup?.keyboard ?? []).flat().map((b) => b.text),
        });
      }
      return { ok: true, result: {} } as never;
    });
  });

  const message = (fields: object, chatType: string = 'private'): Promise<void> =>
    bot.handleUpdate({
      update_id: ++updateId,
      message: {
        message_id: updateId,
        date: Math.floor(now / 1000),
        chat: { id: CHAT_ID, type: chatType },
        from: { id: CHAT_ID, is_bot: false, first_name: 'User' },
        ...fields,
      },
    } as never);

  const text = (value: string): Promise<void> => message({ text: value });
  const last = (): SentMessage => sent[sent.length - 1];

  it('/start показывает плашку с кнопками «Окей» и «Забудь всё»', async () => {
    await text('/start');

    expect(last().text).toContain('не юридическая консультация');
    expect(last().buttons).toEqual(['Окей', 'Забудь всё']);
  });

  it('переход по ссылке или QR-коду ("/start код") тоже начинает разговор', async () => {
    await text('/start qr-demo');

    expect(last().buttons).toEqual(['Окей', 'Забудь всё']);
  });

  it('полный путь: статус кнопкой, даты текстом, находка, кнопка «Начать заново»', async () => {
    await text('/start');
    await text('Окей');
    expect(last().buttons).toHaveLength(5);

    await text('Недавно уволили, ничего не получаю');
    expect(last().buttons).toEqual(['Забудь всё']);

    await text('02.07.2025');
    sent = [];
    await text('15.08.2024 - 30.09.2024\n01.11.2024 - 01.07.2025');

    expect(sent).toHaveLength(3);
    expect(sent[0].text).toContain('Записал:');
    expect(sent[1].text).toContain('Не хватает 70 дн.');
    expect(sent[1].buttons).toEqual([]);
    expect(sent[2].buttons).toEqual(['Начать заново']);
  });

  it('«Забудь всё» показывает подтверждение без лишней кнопки', async () => {
    await text('/start');
    await text('Забудь всё');
    expect(last().buttons).toEqual(['Да, стереть', 'Нет, продолжим']);

    await text('Да, стереть');
    expect(last().text).toContain('стёр твои ответы');
    expect(last().buttons).toEqual(['Начать заново']);
  });

  it('команда из меню с именем бота ("/forget@test_bot") понимается', async () => {
    await text('/start');
    await text('/forget@test_bot');

    expect(last().text).toContain('Точно стереть');
  });

  it('на фото и файлы отвечает, что понимает только текст', async () => {
    await message({ photo: [{ file_id: 'x', file_unique_id: 'y', width: 1, height: 1 }] });

    expect(last().text).toContain('только текст');
  });

  it('в группах молчит', async () => {
    await message({ text: '/start' }, 'group');

    expect(sent).toHaveLength(0);
  });

  it('при потоке сообщений предупреждает один раз и перестаёт отвечать', async () => {
    for (let i: number = 0; i < RATE_LIMIT_MAX_MESSAGES; i++) {
      await text('привет');
    }
    sent = [];

    await text('привет');
    await text('привет');
    await text('привет');

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('Слишком много сообщений');

    // Через минуту лимит снимается.
    now += 61 * 1000;
    await text('/start');
    expect(last().text).toContain('не юридическая консультация');
  });
});
