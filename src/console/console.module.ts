import { Module } from '@nestjs/common';
import { ConversationModule } from '../conversation/conversation.module';
import { ConsoleRunner } from './console.runner';

@Module({
  imports: [ConversationModule],
  providers: [ConsoleRunner],
})
export class ConsoleModule {}
