import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, BotConfig, Context, GrammyError, HttpError } from 'grammy';
import {
  COMMAND_FORGET,
  COMMAND_START,
} from '../conversation/constants/conversation.constants';
import { ConversationService } from '../conversation/conversation.service';
import { BotReply } from '../conversation/types/bot-reply';
import {
  BOT_COMMANDS,
  TEXT_INTERNAL_ERROR,
  TEXT_ONLY_TEXT,
  TEXT_TOO_FAST,
} from './constants/telegram.constants';
import { buildKeyboard } from './keyboard.builder';
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

  constructor(
    private readonly configService: ConfigService,
    private readonly conversation: ConversationService,
    private readonly rateLimiter: RateLimiter,
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

    privateChat.on('message:text', async (ctx): Promise<void> => {
      const chatId: string = String(ctx.chat.id);
      const verdict: RateLimitVerdict = this.rateLimiter.check(chatId);

      if (verdict === 'limit-reached') {
        await ctx.reply(TEXT_TOO_FAST);
      }

      if (verdict !== 'ok') {
        return;
      }

      const reply: BotReply = this.conversation.handleMessage(
        chatId,
        this.normalizeCommand(ctx.message.text),
      );

      await this.send(ctx, reply);
    });

    // Фото, файлы, голосовые, стикеры: не открываем и не сохраняем.
    privateChat.on('message', async (ctx): Promise<void> => {
      if (this.rateLimiter.check(String(ctx.chat.id)) === 'ok') {
        await ctx.reply(TEXT_ONLY_TEXT);
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
    const lastIndex: number = reply.messages.length - 1;

    for (let i: number = 0; i <= lastIndex; i++) {
      // Кнопки прикрепляются к последнему сообщению.
      await ctx.reply(
        reply.messages[i],
        i === lastIndex ? { reply_markup: buildKeyboard(reply) } : undefined,
      );
    }
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
