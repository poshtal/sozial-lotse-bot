import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { AnswerService } from './answer.service';
import { QueryRewriter } from './query-rewriter';

@Module({
  imports: [KnowledgeModule, LlmModule],
  providers: [AnswerService, QueryRewriter],
  exports: [AnswerService, QueryRewriter],
})
export class AnswerModule {}
