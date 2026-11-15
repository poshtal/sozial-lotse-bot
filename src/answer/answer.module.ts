import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { AnswerService } from './answer.service';

@Module({
  imports: [KnowledgeModule, LlmModule],
  providers: [AnswerService],
  exports: [AnswerService],
})
export class AnswerModule {}
