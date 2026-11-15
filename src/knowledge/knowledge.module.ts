import { Module } from '@nestjs/common';
import { EmbeddingsClient } from './embeddings.client';
import { KnowledgeService } from './knowledge.service';
import { QdrantClient } from './qdrant.client';

@Module({
  providers: [KnowledgeService, EmbeddingsClient, QdrantClient],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
