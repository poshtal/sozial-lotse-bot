import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliArgs, parseArgs } from './cli/args';
import { CliModule } from './cli/cli.module';
import { KnowledgeService } from './knowledge/knowledge.service';
import { SearchResult } from './knowledge/types/knowledge-chunk';

/**
 * Проверка поиска отдельно от LLM: показывает, какие куски закона
 * база находит по вопросу и с какой оценкой сходства.
 *
 *   npm run search -- "сколько нужно проработать для пособия"
 *   npm run search -- --limit 5 "что такое Sperrzeit"
 */
async function main(): Promise<void> {
  const args: CliArgs = parseArgs(process.argv.slice(2));
  const question: string = args.rest.join(' ').trim();

  if (question === '') {
    throw new Error('Напиши вопрос: npm run search -- "текст вопроса"');
  }

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });
  const results: SearchResult[] = await app
    .get(KnowledgeService)
    .search(question, args.options.limit ? Number(args.options.limit) : undefined);

  console.log(`\nВопрос: ${question}\n`);

  if (results.length === 0) {
    console.log('Ничего не найдено. База пуста? Запусти загрузку: npm run ingest');
  }

  results.forEach((result: SearchResult, index: number): void => {
    console.log(
      `${index + 1}. [${result.score.toFixed(3)}] ${result.chunk.title} (${result.chunk.chunk_id}, версия ${result.chunk.version})`,
    );
    console.log(`   ${result.chunk.section}`);
    console.log(`   ${result.chunk.text.slice(0, 300).replace(/\n/g, ' ')}...\n`);
  });

  await app.close();
}

main().catch((error: unknown): void => {
  console.error(`Ошибка поиска: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exit(1);
});
