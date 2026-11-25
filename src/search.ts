import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DEFAULT_MIN_RELEVANCE_SCORE } from './answer/constants/answer.constants';
import { CliArgs, parseArgs } from './cli/args';
import { QueryRewriter, RewrittenQuery } from './answer/query-rewriter';
import { CliModule } from './cli/cli.module';
import { KnowledgeService } from './knowledge/knowledge.service';
import { SearchResult } from './knowledge/types/knowledge-chunk';

/**
 * Проверка поиска отдельно от LLM: показывает, какие куски закона
 * ближе всего к вопросу и с какой оценкой сходства.
 *
 * Важно: векторная база всегда возвращает ближайшие куски, даже на вопрос
 * про погоду. Подходят они или нет, решает порог сходства. Команда печатает
 * вердикт: что в этом случае сделает бот.
 *
 *   node dist/search.js "сколько нужно проработать для пособия"
 *   node dist/search.js --limit 10 "что такое Sperrzeit"
 *   node dist/search.js --raw "вопрос"    без переписывания, как раньше
 *
 * По умолчанию вопрос сначала переписывается языком закона, ровно как
 * в боте, и команда показывает, что получилось.
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

  console.log(`\nВопрос: ${question}`);

  let searchText: string = question;

  if (!args.flags.includes('raw')) {
    const rewritten: RewrittenQuery = await app.get(QueryRewriter).rewrite(question);

    if (!rewritten.rewritten) {
      console.log('Переписать не получилось, ищу по исходному вопросу.');
    } else if (!rewritten.inScope) {
      console.log('Модель отметила вопрос как не относящийся к теме.');
      console.log('Вердикт: бот ответит «этого я пока не умею», поиск не нужен.');
      await app.close();
      return;
    } else {
      console.log(`Запрос для поиска: ${rewritten.query}`);
      searchText = rewritten.query;
    }
  }

  const results: SearchResult[] = await app
    .get(KnowledgeService)
    .search(searchText, args.options.limit ? Number(args.options.limit) : undefined);

  const minScore: number = Number(
    app.get(ConfigService).get<string>('MIN_RELEVANCE_SCORE') ??
      DEFAULT_MIN_RELEVANCE_SCORE,
  );

  console.log(`Порог сходства: ${minScore}\n`);

  if (results.length === 0) {
    console.log('База пуста. Запусти загрузку: node dist/ingest.js');
  }

  results.forEach((result: SearchResult, index: number): void => {
    const mark: string = result.score >= minScore ? 'ПОДХОДИТ' : 'ниже порога';
    console.log(
      `${index + 1}. [${result.score.toFixed(3)} ${mark}] ${result.chunk.title} (${result.chunk.chunk_id}, версия ${result.chunk.version})`,
    );
    console.log(`   ${result.chunk.section}`);
    console.log(`   ${result.chunk.text.slice(0, 300).replace(/\n/g, ' ')}...\n`);
  });

  const passed: number = results.filter(
    (result: SearchResult): boolean => result.score >= minScore,
  ).length;

  console.log(
    passed > 0
      ? `Вердикт: ${passed} из ${results.length} кусков проходят порог. Бот передаст их модели и ответит по ним.`
      : 'Вердикт: ни один кусок не проходит порог. Бот ответит «этого я пока не умею», модель не вызывается.',
  );

  await app.close();
}

main().catch((error: unknown): void => {
  console.error(`Ошибка поиска: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exit(1);
});
