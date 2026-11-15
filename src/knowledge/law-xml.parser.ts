import { LawDocument, LawParagraph } from './types/law-document';

/**
 * Разбирает официальный XML закона с gesetze-im-internet.de.
 *
 * Файл состоит из блоков <norm>. Первый описывает закон целиком,
 * блоки с <gliederungseinheit> это заголовки глав и разделов,
 * блоки с <enbez>§ ...</enbez> это сами параграфы.
 */
export function parseLawXml(xml: string): LawDocument {
  const norms: string[] = xml.match(/<norm\b[\s\S]*?<\/norm>/g) ?? [];

  if (norms.length === 0) {
    throw new Error('Law XML has no <norm> elements');
  }

  const law: LawDocument = new LawDocument();
  law.code = readTag(norms[0], 'jurabk');
  law.fullTitle = readTag(norms[0], 'langue');
  law.stand = readTag(norms[0], 'standkommentar');
  law.paragraphs = [];

  if (law.code === '') {
    throw new Error('Law XML has no <jurabk> (law code)');
  }

  // Текущие заголовки: уровень задаётся длиной номера (040, 040010, ...).
  const headings: Map<number, string> = new Map<number, string>();

  for (const norm of norms) {
    const headingNumber: string = readTag(norm, 'gliederungskennzahl');

    if (headingNumber !== '') {
      const level: number = headingNumber.length;
      const heading: string = [
        readTag(norm, 'gliederungsbez'),
        readTag(norm, 'gliederungstitel'),
      ]
        .filter((part: string): boolean => part !== '')
        .join(' ');

      // Новый заголовок сбрасывает все более мелкие.
      for (const key of [...headings.keys()]) {
        if (key >= level) {
          headings.delete(key);
        }
      }
      headings.set(level, heading);
      continue;
    }

    const label: string = readTag(norm, 'enbez');

    if (!label.startsWith('§')) {
      continue; // оглавление, приложения, отменённые диапазоны
    }

    const blocks: string[] = readBlocks(norm);
    const title: string = readTag(norm, 'titel');

    // Отменённые параграфы: "(weggefallen)" и пустой текст.
    if (blocks.length === 0 || title === '(weggefallen)') {
      continue;
    }

    const paragraph: LawParagraph = new LawParagraph();
    paragraph.label = label;
    paragraph.title = title;
    paragraph.section = [...headings.entries()]
      .sort(([a], [b]): number => a - b)
      .map(([, heading]): string => heading)
      .join(' > ');
    paragraph.blocks = blocks;
    law.paragraphs.push(paragraph);
  }

  return law;
}

function readTag(xml: string, tag: string): string {
  const match: RegExpMatchArray | null = xml.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`),
  );

  return match ? cleanInline(match[1].replace(/\s+/g, ' ')) : '';
}

/** Достаёт абзацы текста параграфа. Сноски (<fussnoten>) не берём. */
function readBlocks(norm: string): string[] {
  const text: RegExpMatchArray | null = norm.match(
    /<text\b[^>]*>\s*<Content>([\s\S]*?)<\/Content>\s*<\/text>/,
  );

  if (!text) {
    return [];
  }

  const withBreaks: string = text[1]
    // Таблица: строка на строку, ячейки через " | ". Пустая ячейка остаётся
    // пустой, иначе столбцы съехали бы.
    .replace(/<entry\b[^>]*\/>/g, '<entry></entry>')
    .replace(/<\/entry>\s*<entry\b[^>]*>/g, ' | ')
    .replace(/<\/row>/g, '\n')
    // Нумерованный список: "1." и его текст на одной строке.
    .replace(/<DT\b[^>]*>/g, '\n')
    .replace(/<\/DT>/g, ' ')
    // Текст после списка начинается с новой строки.
    .replace(/<\/DL>/g, '\n')
    .replace(/<BR\s*\/>/g, '\n')
    // Граница абзаца.
    .replace(/<\/P>/g, '\n\n');

  return withBreaks
    .split(/\n\n+/)
    .map((block: string): string =>
      block
        .split('\n')
        .map(cleanInline)
        .filter((line: string): boolean => line !== '')
        .join('\n'),
    )
    .filter((block: string): boolean => block !== '' && block !== '-');
}

/** Убирает теги и лишние пробелы, расшифровывает &amp; и подобное. */
function cleanInline(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t ]+/g, ' ')
    .trim();
}
