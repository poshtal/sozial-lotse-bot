import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleRunner } from './console/console.runner';

async function bootstrap(): Promise<void> {
  // Приложение без HTTP-сервера: наружу не открывается ни один адрес.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  await app.get(ConsoleRunner).run();
  await app.close();
}

bootstrap();
