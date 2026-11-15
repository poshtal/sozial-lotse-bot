import { KnowledgeChunk } from './types/knowledge-chunk';
import { LawDocument, LawParagraph } from './types/law-document';

/** Параграф длиннее этого делится на части по абзацам. */
export const MAX_CHUNK_CHARS: number = 3500;

/**
 * Режет закон на куски для базы знаний. Правило: один параграф это
 * один кусок. Так ссылка на § всегда точная.
 *
 * Только очень длинные параграфы делятся на части, и только по границам
 * абзацев: абзац "(2) ..." никогда не разрывается посередине.
 */
export function chunkLaw(law: LawDocument): KnowledgeChunk[] {
  const sourceId: string = toSlug(law.code);
  const chunks: KnowledgeChunk[] = [];

  for (const paragraph of law.paragraphs) {
    const parts: string[] = splitIntoParts(paragraph.blocks);
    const number: string = toSlug(paragraph.label.replace('§', ''));

    parts.forEach((part: string, index: number): void => {
      const isSplit: boolean = parts.length > 1;
      const chunk: KnowledgeChunk = new KnowledgeChunk();

      chunk.source_id = sourceId;
      chunk.chunk_id = isSplit
        ? `${sourceId}-p${number}-${index + 1}`
        : `${sourceId}-p${number}`;
      chunk.title = `${law.code} ${paragraph.label} ${paragraph.title}`.trim();
      chunk.location = isSplit
        ? `${paragraph.label} (часть ${index + 1} из ${parts.length})`
        : paragraph.label;
      chunk.section = paragraph.section;
      chunk.text = part;
      chunks.push(chunk);
    });
  }

  return chunks;
}

/**
 * Текст, по которому строится вектор. К тексту параграфа добавлен раздел
 * закона: так поиск лучше понимает, о чём кусок. Заголовок идёт отдельно.
 */
export function textForEmbedding(chunk: KnowledgeChunk): string {
  return [chunk.section, chunk.text]
    .filter((part: string): boolean => part !== '')
    .join('\n');
}

function splitIntoParts(blocks: string[]): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  let currentLength: number = 0;

  for (const block of blocks) {
    if (current.length > 0 && currentLength + block.length > MAX_CHUNK_CHARS) {
      parts.push(current.join('\n\n'));
      current = [];
      currentLength = 0;
    }

    current.push(block);
    currentLength += block.length;
  }

  if (current.length > 0) {
    parts.push(current.join('\n\n'));
  }

  return parts;
}

/** "SGB 3" превращается в "sgb-3", " 142a" в "142a". */
function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
