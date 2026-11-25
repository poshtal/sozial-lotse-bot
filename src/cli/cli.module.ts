import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnswerModule } from '../answer/answer.module';
import { ClockModule } from '../clock/clock.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

/** Модуль для служебных команд (загрузка и поиск). Бот здесь не запускается. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClockModule,
    KnowledgeModule,
    AnswerModule,
  ],
})
export class CliModule {}
