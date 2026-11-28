import { ConfigService } from '@nestjs/config';
import { AnswerService } from '../answer/answer.service';
import { Answer } from '../answer/types/answer';
import { Bot } from 'grammy';
import { ClockService } from '../clock/clock.service';
import { ConversationService } from '../conversation/conversation.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { RulesService } from '../rules/rules.service';
import { SessionService } from '../session/session.service';
import { RATE_LIMIT_MAX_MESSAGES } from './constants/telegram.constants';
import { MessageTracker } from './message-tracker';
import { RateLimiter } from './rate-limiter';
import { TelegramRunner } from './telegram.runner';

/** Что бот отправил в Telegram: текст и подписи кнопок. */
interface SentMessage {
  chatId: number;
  text: string;
  buttons: string[];
  /** Номер сообщения, на которое бот отвечает (цитата в Telegram). */
  replyTo?: number;
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
  /** Номера сообщений, которые бот попросил Telegram удалить. */
  let deleted: number[];
  let failDelete: boolean;
  let botMessageId: number;
  let updateId: number;

  beforeEach(() => {
    now = Date.UTC(2025, 6, 10, 9, 0, 0);
    updateId = 0;
    sent = [];
    deleted = [];
    failDelete = false;
    botMessageId = 1000;

    const clock = { now: (): Date => new Date(now) } as ClockService;
    const config = { get: (): undefined => undefined } as unknown as ConfigService;
    const conversation = new ConversationService(
      new QuestionnaireService(config),
      new RulesService(config),
      new SessionService(config, clock),
      clock,
      {
        answer: async (question: string): Promise<Answer> => {
          const answer: Answer = new Answer();
          answer.status = 'answered';
          answer.text = `ОТВЕТ НА: ${question}`;
          return answer;
        },
      } as unknown as AnswerService,
    );
    const runner = new TelegramRunner(
      config,
      conversation,
      new RateLimiter(clock),
      new MessageTracker(clock),
      clock,
    );

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
          reply_parameters?: { message_id: number };
        };
        sent.push({
          chatId: p.chat_id,
          text: p.text,
          buttons: (p.reply_markup?.keyboard ?? []).flat().map((b) => b.text),
          replyTo: p.reply_parameters?.message_id,
        });
      }
      if (method === 'deleteMessages') {
        if (failDelete) {
          return { ok: false, error_code: 400, description: 'Bad Request' } as never;
        }
        deleted.push(...(payload as { message_ids: number[] }).message_ids);
      }
      // Telegram в ответ на отправку возвращает сообщение с его номером.
      if (method === 'sendMessage') {
        return { ok: true, result: { message_id: ++botMessageId } } as never;
      }
      return { ok: true, result: true } as never;
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
    expect(last().buttons).toHaveLength(6);

    await text('Недавно уволили, ничего не получаю');
    expect(last().buttons).toEqual(['Забудь всё']);

    await text('02.07.2025');
    sent = [];
    await text('15.08.2024 - 30.09.2024\n01.11.2024 - 01.07.2025');

    expect(sent).toHaveLength(3);
    expect(sent[0].text).toContain('Записал:');
    expect(sent[1].text).toContain('Не хватает 70 дн.');
    expect(sent[1].buttons).toEqual([]);
    // Дальше бот предлагает то, что может быть доступно уволенному без
    // права на пособие: пять пунктов, «Закончить» и «Забудь всё».
    expect(sent[2].buttons).toHaveLength(7);
    expect(sent[2].buttons.slice(-2)).toEqual(['Закончить', 'Забудь всё']);

    await text('Закончить');
    // Разговор закончен, но переписка на экране: её ещё можно убрать.
    expect(last().buttons).toEqual(['Начать заново', 'Забудь всё']);
  });

  it('«Забудь всё» после подтверждения убирает всю переписку из чата', async () => {
    await text('/start');
    await text('Окей');
    await text('Забудь всё');
    expect(last().buttons).toEqual(['Да, стереть', 'Нет, продолжим']);
    expect(deleted).toEqual([]);

    await text('Да, стереть');

    // Удалены все четыре сообщения человека и три ответа бота до этого момента.
    expect(deleted.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 1001, 1002, 1003]);
    expect(last().text).toContain('убрал нашу переписку');
    expect(last().buttons).toEqual(['Начать заново']);
  });

  it('после конца разговора «Забудь всё» убирает переписку без лишних вопросов', async () => {
    await text('/start');
    await text('Окей');
    await text('Работаю');
    await text('нет');
    await text('Закончить');
    expect(last().buttons).toEqual(['Начать заново', 'Забудь всё']);

    await text('Забудь всё');

    expect(deleted.length).toBeGreaterThanOrEqual(11);
    expect(last().text).toContain('убрал нашу переписку');
  });

  it('второе «Забудь всё» не удаляет уже удалённое', async () => {
    await text('/start');
    await text('/forget');
    await text('Да, стереть');
    const firstRound: number = deleted.length;

    await text('/forget');

    // Удаляются только сообщение об успехе и сама новая команда.
    expect(deleted.length).toBe(firstRound + 2);
  });

  it('если Telegram не дал удалить сообщения, бот честно говорит об этом', async () => {
    await text('/start');
    await text('/forget');
    failDelete = true;
    await text('Да, стереть');

    expect(last().text).toContain('убрать сообщения из чата не получилось');
  });

  it('команда из меню с именем бота ("/forget@test_bot") понимается', async () => {
    await text('/start');
    await text('/forget@test_bot');

    expect(last().text).toContain('Точно стереть');
  });

  const goToTopics = async (): Promise<void> => {
    await text('/start');
    await text('Окей');
    await text('Работаю');
    await text('нет');
  };

  it('ответ на вопрос привязан к сообщению с этим вопросом', async () => {
    await goToTopics();
    sent = [];

    // Человек не дождался ответа и успел написать ещё два сообщения.
    await text('Встать на учёт заранее');
    await text('какая погода в берлине?');

    // Сообщения человека имеют номера 5 и 6.
    expect(sent[0].text).toContain('ОТВЕТ НА: Когда нужно встать на учёт');
    expect(sent[0].replyTo).toBe(5);
    expect(sent[2].text).toContain('ОТВЕТ НА: какая погода в берлине?');
    expect(sent[2].replyTo).toBe(6);
    // Обычные сообщения анкеты идут без привязки.
    expect(sent[1].replyTo).toBeUndefined();
  });

  it('повторное нажатие той же кнопки до ответа бота игнорируется', async () => {
    await goToTopics();
    sent = [];

    await text('Сколько месяцев платят пособие');
    await text('Сколько месяцев платят пособие');

    // Один ответ и одно «Что ещё рассказать?», а не два.
    expect(sent).toHaveLength(2);
  });

  it('тот же вопрос, заданный позже, получает новый ответ', async () => {
    await goToTopics();
    await text('Сколько месяцев платят пособие');
    sent = [];

    now += 30 * 1000;
    await text('Сколько месяцев платят пособие');

    expect(sent).toHaveLength(2);
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
