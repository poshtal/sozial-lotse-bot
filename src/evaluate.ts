import 'reflect-metadata';
import { readFileSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AnswerService } from './answer/answer.service';
import { DEFAULT_MIN_RELEVANCE_SCORE } from './answer/constants/answer.constants';
import { Answer } from './answer/types/answer';
import { CliArgs, parseArgs } from './cli/args';
import { CliModule } from './cli/cli.module';
import { EvalCase, EvalResult, judge, parseCases } from './evaluation/evaluation';
import { buildReport } from './evaluation/report';

/**
 * Проверка качества ответов на контрольном наборе вопросов.
 *
 * Каждый вопрос проходит тот же путь, что в боте (переписывание, поиск,
 * порог, ответ модели), но без Telegram. Результат сравнивается
 * с ожиданием, записанным заранее, и печатается отчёт в Markdown.
 *
 *   node dist/evaluate.js                          набор data/evaluation.csv
 *   node dist/evaluate.js --file data/другой.csv   другой набор
 *   node dist/evaluate.js --delay 10000            пауза между вопросами, мс
 *
 * Пауза нужна из-за лимита бесплатного Gemini: на вопрос уходит два запроса.
 * Ход проверки печатается в stderr, отчёт в stdout, поэтому отчёт можно
 * сохранить в файл: node dist/evaluate.js > reports/evaluation.md
 */
const DEFAULT_DELAY_MS: number = 6000;

async function main(): Promise<void> {
  const args: CliArgs = parseArgs(process.argv.slice(2));
  const file: string = args.options.file ?? 'data/evaluation.csv';
  const delay: number = Number(args.options.delay ?? DEFAULT_DELAY_MS);

  const cases: EvalCase[] = parseCases(readFileSync(file, 'utf-8'));

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });
  const answers: AnswerService = app.get(AnswerService);
  const minScore: number = Number(
    app.get(ConfigService).get<string>('MIN_RELEVANCE_SCORE') ??
      DEFAULT_MIN_RELEVANCE_SCORE,
  );

  const results: EvalResult[] = [];

  for (const [index, evalCase] of cases.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    console.error(`${index + 1}/${cases.length}: ${evalCase.question}`);
    const answer: Answer = await answers.answer(evalCase.question);
    const result: EvalResult = judge(evalCase, answer);
    console.error(`   ${result.verdict}: ${result.reason}`);
    results.push(result);
  }

  const date: string = new Date().toISOString().slice(0, 10);
  console.log(buildReport(results, minScore, date));

  await app.close();
}

main().catch((error: unknown): void => {
  console.error(`Ошибка проверки: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exit(1);
});
