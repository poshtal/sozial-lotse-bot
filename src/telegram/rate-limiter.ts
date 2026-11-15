import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import {
  RATE_LIMIT_MAX_MESSAGES,
  RATE_LIMIT_WINDOW_MS,
} from './constants/telegram.constants';

export type RateLimitVerdict = 'ok' | 'limit-reached' | 'blocked';

class ChatWindow {
  startedAt: number;
  count: number;
}

/**
 * Защита от спама: не больше N сообщений от одного чата за окно времени.
 * Хранит только счётчик и время, без текста сообщений.
 */
@Injectable()
export class RateLimiter {
  private readonly windows: Map<string, ChatWindow> = new Map<
    string,
    ChatWindow
  >();

  constructor(private readonly clock: ClockService) {}

  /**
   * ok: сообщение можно обрабатывать.
   * limit-reached: лимит только что превышен, человеку стоит об этом сказать.
   * blocked: лимит превышен и человек уже предупреждён, молчим.
   */
  check(chatId: string): RateLimitVerdict {
    const now: number = this.clock.now().getTime();
    this.removeOldWindows(now);

    let window: ChatWindow | undefined = this.windows.get(chatId);

    if (!window) {
      window = { startedAt: now, count: 0 };
      this.windows.set(chatId, window);
    }

    window.count++;

    if (window.count <= RATE_LIMIT_MAX_MESSAGES) {
      return 'ok';
    }

    return window.count === RATE_LIMIT_MAX_MESSAGES + 1
      ? 'limit-reached'
      : 'blocked';
  }

  private removeOldWindows(now: number): void {
    for (const [chatId, window] of this.windows.entries()) {
      if (now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
        this.windows.delete(chatId);
      }
    }
  }
}
