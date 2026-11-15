import { Injectable } from '@nestjs/common';
import * as readline from 'readline';
import { ConversationService } from '../conversation/conversation.service';
import { BotReply } from '../conversation/types/bot-reply';

const CONSOLE_CHAT_ID: string = 'console';

/**
 * Временная оболочка: разговор с ботом в терминале.
 * Нужна, чтобы проверять логику без Telegram. Сама ничего не решает:
 * передаёт строку в ядро и печатает ответ.
 */
@Injectable()
export class ConsoleRunner {
  constructor(private readonly conversation: ConversationService) {}

  async run(): Promise<void> {
    const rl: readline.Interface = readline.createInterface({
      input: process.stdin,
    });

    console.log('Консольный режим. Команды: /start, /forget, выход: Ctrl+C\n');
    this.print(await this.conversation.handleMessage(CONSOLE_CHAT_ID, '/start'));

    // Несколько строк подряд без паузы (вставленный список мест работы)
    // склеиваются в одно сообщение, как это будет в Telegram.
    let buffer: string[] = [];
    let timer: NodeJS.Timeout | undefined;
    // Сообщения обрабатываются строго по очереди, даже если ответ долгий.
    let queue: Promise<void> = Promise.resolve();

    const flush = (): void => {
      const text: string = buffer.join('\n');
      buffer = [];
      queue = queue.then(async (): Promise<void> => {
        this.print(await this.conversation.handleMessage(CONSOLE_CHAT_ID, text));
      });
    };

    for await (const line of rl) {
      buffer.push(line);
      clearTimeout(timer);
      timer = setTimeout(flush, 150);
    }

    clearTimeout(timer);
    if (buffer.length > 0) {
      flush();
    }
    await queue;
  }

  private print(reply: BotReply): void {
    for (const message of reply.messages) {
      console.log(`\nБот: ${message}`);
    }

    reply.options.forEach((option: string, index: number): void => {
      console.log(`  [${index + 1}] ${option}`);
    });

    console.log('\nТы: ');
  }
}
