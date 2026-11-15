import { readFileSync } from 'fs';
import { join } from 'path';
import { chunkLaw, MAX_CHUNK_CHARS, textForEmbedding } from './chunker';
import { parseLawXml } from './law-xml.parser';
import { createParagraphFilter } from './paragraph-filter';
import { KnowledgeChunk } from './types/knowledge-chunk';
import { LawDocument, LawParagraph } from './types/law-document';

/** Образец вырезан из настоящего XML SGB III (редакция от 24.07.2026). */
const SAMPLE: string = readFileSync(
  join(__dirname, 'fixtures', 'sgb3-sample.xml'),
  'utf-8',
);

describe('parseLawXml', () => {
  const law: LawDocument = parseLawXml(SAMPLE);
  const find = (label: string): LawParagraph =>
    law.paragraphs.find((p) => p.label === label) as LawParagraph;

  it('читает сведения о законе и его редакции', () => {
    expect(law.code).toBe('SGB 3');
    expect(law.fullTitle).toContain('Arbeitsförderung');
    expect(law.stand).toBe('Zuletzt geändert durch Art. 1a G v. 24.7.2026 I Nr. 228');
  });

  it('берёт только действующие параграфы', () => {
    // § 6 отменён (weggefallen), диапазон "§§ 186 bis 239" тоже.
    expect(law.paragraphs.map((p) => p.label)).toEqual([
      '§ 26',
      '§ 136',
      '§ 142',
      '§ 143',
      '§ 147',
    ]);
  });

  it('§ 142: название, раздел и два абзаца', () => {
    const p: LawParagraph = find('§ 142');

    expect(p.title).toBe('Anwartschaftszeit');
    expect(p.section).toBe(
      'Viertes Kapitel Arbeitslosengeld und Insolvenzgeld > Erster Abschnitt Arbeitslosengeld > Erster Unterabschnitt Regelvoraussetzungen',
    );
    expect(p.blocks).toHaveLength(2);
    expect(p.blocks[0]).toContain('mindestens zwölf Monate');
  });

  it('нумерованный список: каждый пункт с новой строки, текст после списка тоже', () => {
    const lines: string[] = find('§ 142').blocks[1].split('\n');

    expect(lines[1]).toMatch(/^1\. sich die in der Rahmenfrist/);
    expect(lines[2]).toMatch(/^2\. das in den letzten zwölf Monaten/);
    expect(lines[3]).toBe(
      'beträgt die Anwartschaftszeit sechs Monate. § 27 Absatz 3 Nummer 1 bleibt unberührt.',
    );
  });

  it('§ 143: Rahmenfrist 30 месяцев', () => {
    expect(find('§ 143').blocks[0]).toBe(
      '(1) Die Rahmenfrist beträgt 30 Monate und beginnt mit dem Tag vor der Erfüllung aller sonstigen Voraussetzungen für den Anspruch auf Arbeitslosengeld.',
    );
  });

  it('таблица в § 147 читается построчно, пустые ячейки не съезжают', () => {
    const text: string = find('§ 147').blocks.join('\n');

    expect(text).toContain('12 | | 6');
    expect(text).toContain('30 | 50. | 15');
  });

  it('сноски и теги в текст не попадают', () => {
    const all: string = law.paragraphs.map((p) => p.blocks.join('\n')).join('\n');

    expect(all).not.toContain('+++');
    expect(all).not.toMatch(/<[A-Za-z]/);
  });

  it('раздел сбрасывается при переходе в другую главу', () => {
    expect(find('§ 26').section).toBe(
      'Erstes Kapitel Allgemeine Vorschriften > Erster Abschnitt Grundsätze',
    );
    expect(find('§ 147').section).toContain('Zweiter Unterabschnitt');
    expect(find('§ 147').section).not.toContain('Regelvoraussetzungen');
  });

  it('понятная ошибка, если файл не похож на закон', () => {
    expect(() => parseLawXml('<html></html>')).toThrow('no <norm>');
  });
});

describe('chunkLaw', () => {
  const chunks: KnowledgeChunk[] = chunkLaw(parseLawXml(SAMPLE));
  const byId = (id: string): KnowledgeChunk =>
    chunks.find((c) => c.chunk_id === id) as KnowledgeChunk;

  it('обычный параграф это один кусок с полями из инструкции', () => {
    const chunk: KnowledgeChunk = byId('sgb-3-p142');

    expect(chunk.source_id).toBe('sgb-3');
    expect(chunk.title).toBe('SGB 3 § 142 Anwartschaftszeit');
    expect(chunk.location).toBe('§ 142');
    expect(chunk.text).toContain('(1) Die Anwartschaftszeit');
    expect(chunk.text).toContain('(2) Für Arbeitslose');
  });

  it('длинный параграф делится по границам абзацев', () => {
    const parts: KnowledgeChunk[] = chunks.filter((c) =>
      c.chunk_id.startsWith('sgb-3-p26-'),
    );

    expect(parts.map((c) => c.location)).toEqual([
      '§ 26 (часть 1 из 2)',
      '§ 26 (часть 2 из 2)',
    ]);
    // Каждая часть начинается с начала абзаца: "(1)", "(2)" и так далее.
    for (const part of parts) {
      expect(part.text).toMatch(/^\(\d+[a-z]?\) /);
      expect(part.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 2000);
    }
  });

  it('номера кусков не повторяются и пустых кусков нет', () => {
    expect(new Set(chunks.map((c) => c.chunk_id)).size).toBe(chunks.length);
    expect(chunks.every((c) => c.text.trim().length > 0)).toBe(true);
  });

  it('в текст для вектора добавлен раздел закона', () => {
    const text: string = textForEmbedding(byId('sgb-3-p143'));

    expect(text.split('\n')[0]).toContain('Erster Abschnitt Arbeitslosengeld');
    expect(text).toContain('(1) Die Rahmenfrist beträgt 30 Monate');
  });
});

describe('createParagraphFilter', () => {
  it('понимает диапазоны и отдельные номера', () => {
    const keep = createParagraphFilter('136-143, 26');

    expect(keep('§ 26')).toBe(true);
    expect(keep('§ 136')).toBe(true);
    expect(keep('§ 142a')).toBe(true);
    expect(keep('§ 147')).toBe(false);
  });

  it('без условия берёт всё', () => {
    expect(createParagraphFilter(undefined)('§ 999')).toBe(true);
    expect(createParagraphFilter('  ')('§ 1')).toBe(true);
  });

  it('объясняет ошибку в записи', () => {
    expect(() => createParagraphFilter('136-abc')).toThrow('Не понял номера');
  });
});
