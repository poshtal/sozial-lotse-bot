import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClockModule } from './clock/clock.module';
import { ConsoleModule } from './console/console.module';
import { ConversationModule } from './conversation/conversation.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClockModule,
    ConversationModule,
    ConsoleModule,
    TelegramModule,
  ],
})
export class AppModule {}
