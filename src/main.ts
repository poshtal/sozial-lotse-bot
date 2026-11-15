import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ConsoleRunner } from './console/console.runner';
import { TelegramRunner } from './telegram/telegram.runner';

async function bootstrap(): Promise<void> {
  // Приложение без HTTP-сервера: наружу не открывается ни один адрес.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  // Ctrl+C и остановка контейнера корректно останавливают бота.
  app.enableShutdownHooks();

  const config: ConfigService = app.get(ConfigService);
  const hasToken: boolean = Boolean(config.get<string>('TELEGRAM_BOT_TOKEN'));

  // INTERFACE=console включает разговор в терминале, даже если токен есть.
  const mode: string =
    config.get<string>('INTERFACE') ?? (hasToken ? 'telegram' : 'console');

  if (mode === 'telegram') {
    await app.get(TelegramRunner).run();
  } else {
    await app.get(ConsoleRunner).run();
  }

  await app.close();
}

bootstrap().catch((error: unknown): void => {
  const message: string = error instanceof Error ? error.message : 'unknown';
  console.error(`Ошибка запуска: ${message}`);
  process.exit(1);
});
