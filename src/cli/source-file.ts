import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { strFromU8, unzipSync } from 'fflate';

/**
 * Читает XML закона из файла .xml или из архива .zip
 * (в таком виде его отдаёт gesetze-im-internet.de).
 */
export function readLawXml(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`Файл не найден: ${filePath}`);
  }

  if (!filePath.toLowerCase().endsWith('.zip')) {
    return readFileSync(filePath, 'utf-8');
  }

  const files = unzipSync(new Uint8Array(readFileSync(filePath)));
  const xmlName: string | undefined = Object.keys(files).find((name: string) =>
    name.toLowerCase().endsWith('.xml'),
  );

  if (!xmlName) {
    throw new Error(`В архиве ${filePath} нет XML-файла`);
  }

  return strFromU8(files[xmlName]);
}

/** Все файлы законов в папке с исходниками. */
export function listSourceFiles(sourceDir: string): string[] {
  if (!existsSync(sourceDir)) {
    return [];
  }

  return readdirSync(sourceDir)
    .filter((name: string): boolean => /\.(zip|xml)$/i.test(name))
    .sort()
    .map((name: string): string => join(sourceDir, name));
}
