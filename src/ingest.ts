import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { CliArgs, parseArgs } from './cli/args';
import { CliModule } from './cli/cli.module';
import { listSourceFiles, readLawXml } from './cli/source-file';
import { IngestReport, KnowledgeService } from './knowledge/knowledge.service';
import { parseLawXml } from './knowledge/law-xml.parser';
import { LawDocument } from './knowledge/types/law-document';

/**
 * Загрузка закона в базу знаний. Запускает только владелец проекта,
 * со своего компьютера:
 *
 *   npm run ingest -- --paragraphs 136-164
 *   npm run ingest -- --file data/source/sgb_3.zip
 *
 * Без --file берутся все архивы из data/source.
 * Без --paragraphs загружается закон целиком.
 */
async function main(): Promise<void> {
  const args: CliArgs = parseArgs(process.argv.slice(2));
  const sourceDir: string = join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'source');
  const files: string[] = args.options.file
    ? [args.options.file]
    : listSourceFiles(sourceDir);

  if (files.length === 0) {
    throw new Error(`В папке ${sourceDir} нет файлов .zip или .xml`);
  }

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });
  const knowledge: KnowledgeService = app.get(KnowledgeService);

  for (const file of files) {
    console.log(`\nФайл: ${file}`);
    const law: LawDocument = parseLawXml(readLawXml(file));
    console.log(`Закон: ${law.code}. Редакция: ${law.stand}`);
    console.log(`Параграфов в файле: ${law.paragraphs.length}`);

    const report: IngestReport = await knowledge.ingestLaw(
      law,
      args.options.paragraphs,
      (message: string): void => console.log(message),
    );

    if (report.status === 'unchanged') {
      console.log(
        `Без изменений: это содержимое уже загружено как версия ${report.version}.`,
      );
    } else {
      console.log(
        `Готово: источник ${report.sourceId}, версия ${report.version}, кусков ${report.chunks}.`,
      );
      if (report.deactivated > 0) {
        console.log(
          `Прежняя версия сохранена и помечена неактуальной: ${report.deactivated} кусков.`,
        );
      }
    }
  }

  await app.close();
}

main().catch((error: unknown): void => {
  console.error(`Ошибка загрузки: ${error instanceof Error ? error.message : 'unknown'}`);
  process.exit(1);
});
