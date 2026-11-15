import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../clock/clock.service';
import {
  Bot,
  BotConfig,
  Context,
  GrammyError,
  HttpError,
  Keyboard,
} from 'grammy';
import {
  COMMAND_FORGET,
  COMMAND_START,
} from '../conversation/constants/conversation.constants';
import { ConversationService } from '../conversation/conversation.service';
import { BotReply } from '../conversation/types/bot-reply';
import {
  BOT_COMMANDS,
  DELETE_BATCH_SIZE,
  TEXT_CHAT_ERASED,
  TEXT_CHAT_NOT_ERASED,
  TEXT_INTERNAL_ERROR,
  TEXT_ONLY_TEXT,
  TEXT_TOO_FAST,
} from './constants/telegram.constants';
import { buildKeyboard } from './keyboard.builder';
import { MessageTracker } from './message-tracker';
import { RateLimiter, RateLimitVerdict } from './rate-limiter';

/**
 * Оболочка для Telegram. Сама ничего не решает: передаёт текст в ядро
 * (ConversationService) и показывает ответ с кнопками.
 *
 * Бот сам забирает сообщения у Telegram (long polling), поэтому у программы
 * нет ни одного адреса, открытого наружу.
 */
@Injectable()
export class TelegramRunner implements OnModuleDestroy {
  private bot?: Bot;
  /** Последнее обработанное сообщение каждого чата: текст и время ответа. */
  private readonly lastHandled: Map<string, { text: string; repliedAt: number }> =
    new Map<string, { text: string; repliedAt: number }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly conversation: ConversationService,
    private readonly rateLimiter: RateLimiter,
    private readonly tracker: MessageTracker,
    private readonly clock: ClockService,
  ) {}

  async run(): Promise<void> {
    const token: string | undefined =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
    }

    this.bot = this.createBot(token);

    try {
      await this.bot.api.setMyCommands(BOT_COMMANDS);

      // Промис завершается, когда бот остановлен (Ctrl+C или остановка контейнера).
      await this.bot.start({
        onStart: (botInfo): void => {
          console.log(`Бот @${botInfo.username} запущен. Остановка: Ctrl+C`);
        },
      });
    } catch (error) {
      throw new Error(this.describeStartError(error));
    }
  }

  /** Понятное сообщение вместо длинной ошибки. Токен в текст не попадает. */
  private describeStartError(error: unknown): string {
    if (error instanceof GrammyError && error.error_code === 401) {
      return 'Telegram не принял токен. Проверь TELEGRAM_BOT_TOKEN в файле .env';
    }

    if (error instanceof GrammyError && error.error_code === 409) {
      return 'Этот бот уже запущен в другом месте. Останови вторую копию.';
    }

    if (error instanceof HttpError) {
      return 'Нет связи с Telegram. Проверь интернет и попробуй ещё раз.';
    }

    return error instanceof GrammyError
      ? `Telegram ответил ошибкой: ${error.description}`
      : 'Не удалось запустить бота.';
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot?.stop();
  }

  /** Создаёт бота и вешает обработчики. Вынесено отдельно ради тестов. */
  createBot(token: string, config?: BotConfig<Context>): Bot {
    const bot: Bot = new Bot(token, config);

    // Бот работает только в личных чатах: в группах ответы видели бы все.
    const privateChat = bot.chatType('private');

    // Запоминаем номер каждого входящего сообщения (только номер, не текст),
    // чтобы по просьбе «Забудь всё» убрать переписку с экрана.
    privateChat.on('message', async (ctx, next): Promise<void> => {
      this.tracker.remember(String(ctx.chat.id), ctx.message.message_id);
      await next();
    });

    privateChat.on('message:text', async (ctx): Promise<void> => {
      const chatId: string = String(ctx.chat.id);
      const verdict: RateLimitVerdict = this.rateLimiter.check(chatId);

      if (verdict === 'limit-reached') {
        await this.sendText(ctx, TEXT_TOO_FAST);
      }

      if (verdict !== 'ok') {
        return;
      }

      const text: string = this.normalizeCommand(ctx.message.text);

      // Нетерпеливое повторное нажатие: тот же текст отправлен раньше, чем
      // бот успел ответить на первый. Второй раз не отвечаем.
      if (this.isImpatientRepeat(chatId, text, ctx.message.date)) {
        return;
      }

      // Ответ по базе знаний занимает несколько секунд: показываем «печатает».
      await ctx.replyWithChatAction('typing').catch((): void => undefined);

      const reply: BotReply = await this.conversation.handleMessage(chatId, text);

      await this.send(ctx, reply);
      this.lastHandled.set(chatId, {
        text,
        repliedAt: Math.floor(this.clock.now().getTime() / 1000),
      });
    });

    // Фото, файлы, голосовые, стикеры: не открываем и не сохраняем.
    privateChat.on('message', async (ctx): Promise<void> => {
      if (this.rateLimiter.check(String(ctx.chat.id)) === 'ok') {
        await this.sendText(ctx, TEXT_ONLY_TEXT);
      }
    });

    bot.catch(async (botError): Promise<void> => {
      // В лог идёт только тип ошибки. Текст сообщения человека не пишем.
      const error: unknown = botError.error;
      const details: string =
        error instanceof GrammyError
          ? `${error.method}: ${error.description}`
          : error instanceof Error
            ? error.name
            : 'unknown error';

      console.error(`Telegram handler failed (${details})`);

      try {
        await botError.ctx.reply(TEXT_INTERNAL_ERROR);
      } catch {
        // Если не удалось даже ответить, остаётся только запись в логе.
      }
    });

    return bot;
  }

  private async send(ctx: Context, reply: BotReply): Promise<void> {
    if (reply.eraseChat) {
      // Вместо текста ядра говорим, что получилось с перепиской на экране.
      const erased: boolean = await this.eraseChat(ctx);
      reply.messages = [erased ? TEXT_CHAT_ERASED : TEXT_CHAT_NOT_ERASED];
    }

    const lastIndex: number = reply.messages.length - 1;

    for (let i: number = 0; i <= lastIndex; i++) {
      // Кнопки прикрепляются к последнему сообщению.
      await this.sendText(
        ctx,
        reply.messages[i],
        i === lastIndex ? buildKeyboard(reply) : undefined,
        // Ответ на вопрос приходит с задержкой, и за это время человек мог
        // написать что-то ещё. Показываем, на какое сообщение это ответ.
        i === 0 && reply.answersQuestion ? ctx.message?.message_id : undefined,
      );
    }
  }

  /**
   * true, если такое же сообщение было отправлено ещё до того, как бот
   * ответил на предыдущее. Человек не мог видеть ответ, значит это не новый
   * вопрос, а повторное нажатие от нетерпения.
   */
  private isImpatientRepeat(
    chatId: string,
    text: string,
    sentAt: number,
  ): boolean {
    const last = this.lastHandled.get(chatId);
    return last !== undefined && last.text === text && sentAt <= last.repliedAt;
  }

  /** Отправляет сообщение и запоминает его номер. */
  private async sendText(
    ctx: Context,
    text: string,
    keyboard?: Keyboard,
    replyToMessageId?: number,
  ): Promise<void> {
    const sent = await ctx.reply(text, {
      ...(keyboard ? { reply_markup: keyboard } : {}),
      ...(replyToMessageId
        ? {
            reply_parameters: {
              message_id: replyToMessageId,
              // Если исходное сообщение уже удалено, ответ всё равно уйдёт.
              allow_sending_without_reply: true,
            },
          }
        : {}),
    });
    this.tracker.remember(String(ctx.chat?.id), sent.message_id);
  }

  /**
   * Убирает из чата все сообщения, номера которых бот помнит: и свои,
   * и человека. Возвращает false, если Telegram отказал.
   */
  private async eraseChat(ctx: Context): Promise<boolean> {
    const chatId: number | undefined = ctx.chat?.id;

    if (chatId === undefined) {
      return false;
    }

    const ids: number[] = this.tracker.take(String(chatId));
    let allDeleted: boolean = true;

    for (let start: number = 0; start < ids.length; start += DELETE_BATCH_SIZE) {
      try {
        await ctx.api.deleteMessages(
          chatId,
          ids.slice(start, start + DELETE_BATCH_SIZE),
        );
      } catch {
        allDeleted = false;
      }
    }

    return allDeleted;
  }

  /**
   * Telegram может прислать команду с добавками: "/start@my_bot" в меню
   * или "/start abc" при переходе по ссылке и QR-коду. Ядру нужна чистая.
   */
  private normalizeCommand(text: string): string {
    const firstWord: string = text.trim().split(/\s+/)[0].split('@')[0];

    return firstWord === COMMAND_START || firstWord === COMMAND_FORGET
      ? firstWord
      : text;
  }
}
