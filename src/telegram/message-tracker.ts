import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import {
  MAX_TRACKED_MESSAGES,
  MESSAGE_DELETE_WINDOW_MS,
} from './constants/telegram.constants';

class TrackedMessage {
  id: number;
  sentAt: number;
}

/**
 * Помнит номера сообщений в чате, чтобы по просьбе «Забудь всё» убрать
 * переписку с экрана человека.
 *
 * Хранятся только номера, без текста: по номеру нельзя узнать, что было
 * написано. Живут в оперативной памяти, после перезапуска бота их нет.
 */
@Injectable()
export class MessageTracker {
  private readonly messages: Map<string, TrackedMessage[]> = new Map<
    string,
    TrackedMessage[]
  >();

  constructor(private readonly clock: ClockService) {}

  remember(chatId: string, messageId: number | undefined): void {
    if (messageId === undefined) {
      return;
    }

    const list: TrackedMessage[] = this.messages.get(chatId) ?? [];
    list.push({ id: messageId, sentAt: this.clock.now().getTime() });

    // Не даём списку расти бесконечно.
    this.messages.set(chatId, list.slice(-MAX_TRACKED_MESSAGES));
  }

  /**
   * Отдаёт номера сообщений, которые ещё можно удалить, и забывает их.
   * Сообщения старше окна Telegram удалить не даст, их не возвращаем.
   */
  take(chatId: string): number[] {
    const now: number = this.clock.now().getTime();
    const list: TrackedMessage[] = this.messages.get(chatId) ?? [];
    this.messages.delete(chatId);

    return list
      .filter((m: TrackedMessage): boolean => now - m.sentAt < MESSAGE_DELETE_WINDOW_MS)
      .map((m: TrackedMessage): number => m.id);
  }
}
