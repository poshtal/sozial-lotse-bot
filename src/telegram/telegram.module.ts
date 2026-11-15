import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { MessageTracker } from './message-tracker';
import { RateLimiter } from './rate-limiter';
import { TelegramRunner } from './telegram.runner';

@Module({
  imports: [ConversationModule],
  providers: [TelegramRunner, RateLimiter, MessageTracker],
})
export class TelegramModule {}
