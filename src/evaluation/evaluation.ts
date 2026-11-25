import { Answer, AnswerTraceResult } from '../answer/types/answer';

/**
 * Что бот должен сделать с вопросом:
 * - answer: ответить по закону, сославшись на нужные параграфы;
 * - refuse: честно сказать «не умею», вопрос по теме, но ответа в базе нет;
 * - partial: ответ возможен лишь частично, оценивает человек;
 * - out_of_scope: отсеять сразу, на шаге переписывания, без поиска.
 */
export type Expectation = 'answer' | 'refuse' | 'partial' | 'out_of_scope';

const EXPECTATIONS: Expectation[] = ['answer', 'refuse', 'partial', 'out_of_scope'];

/** Одна строка контрольного набора. */
export class EvalCase {
  id: string;
  question: string;
  expected: Expectation;
  /** Номера параграфов, где лежит ответ: ["38", "141"]. */
  paragraphs: string[];
  note: string;
}

/**
 * pass: бот сделал то, что ожидалось;
 * fail: не сделал;
 * check: автоматически не решить, нужен взгляд человека.
 */
export type Verdict = 'pass' | 'fail' | 'check';

export class EvalResult {
  evalCase: EvalCase;
  status: Answer['status'];
  verdict: Verdict;
  /** Почему такой вердикт, по-русски. */
  reason: string;
  /** Место первого нужного параграфа в выдаче поиска (с 1), null если его там нет. */
  rank: number | null;
  answer: Answer;
}

/**
 * Читает контрольный набор. Разделитель «;», первая строка заголовок,
 * пустые строки и строки с # пропускаются.
 */
export function parseCases(csv: string): EvalCase[] {
  const lines: string[] = csv
    .split(/\r?\n/)
    .map((line: string): string => line.trim())
    .filter((line: string): boolean => line !== '' && !line.startsWith('#'));

  return lines.slice(1).map((line: string, index: number): EvalCase => {
    const [id, question, expected, paragraphs, note] = line.split(';');

    if (!question || !EXPECTATIONS.includes(expected as Expectation)) {
      throw new Error(
        `Строка ${index + 2}: нужен вопрос и ожидание (${EXPECTATIONS.join(', ')}).`,
      );
    }

    return {
      id: id.trim(),
      question: question.trim(),
      expected: expected as Expectation,
      paragraphs: (paragraphs ?? '')
        .split(',')
        .map((p: string): string => p.trim())
        .filter((p: string): boolean => p !== ''),
      note: (note ?? '').trim(),
    };
  });
}

/** Номер параграфа по номеру куска: "sgb-3-p159-1" → "159", "sgb-3-p26a" → "26a". */
export function paragraphOf(chunkId: string): string | null {
  const match: RegExpMatchArray | null = chunkId.match(/-p(\d+[a-z]?)(?:-\d+)?$/);
  return match ? match[1] : null;
}

/** Сравнивает ответ бота с ожиданием из контрольного набора. */
export function judge(evalCase: EvalCase, answer: Answer): EvalResult {
  const results: AnswerTraceResult[] = answer.trace?.results ?? [];
  const isExpected = (chunkId: string): boolean =>
    evalCase.paragraphs.includes(paragraphOf(chunkId) ?? '');

  const position: number = results.findIndex((r: AnswerTraceResult): boolean =>
    isExpected(r.chunk_id),
  );

  const result: EvalResult = new EvalResult();
  result.evalCase = evalCase;
  result.status = answer.status;
  result.answer = answer;
  result.rank = position >= 0 ? position + 1 : null;

  const [verdict, reason] = decide(evalCase, answer, isExpected);
  result.verdict = verdict;
  result.reason = reason;
  return result;
}

function decide(
  evalCase: EvalCase,
  answer: Answer,
  isExpected: (chunkId: string) => boolean,
): [Verdict, string] {
  if (answer.status === 'failed') {
    return ['fail', 'сбой: модель или база недоступны'];
  }

  const filtered: boolean = answer.trace?.inScope === false;

  switch (evalCase.expected) {
    case 'out_of_scope':
      return filtered
        ? ['pass', 'отсеян как вопрос не по теме']
        : ['fail', 'модель сочла вопрос относящимся к теме'];

    case 'refuse':
      return answer.status === 'unknown'
        ? ['pass', filtered ? 'отсеян как вопрос не по теме' : 'честно отказал']
        : ['fail', 'ответил, хотя ответа в базе нет'];

    case 'partial':
      return answer.status === 'unknown'
        ? ['check', 'отказал: проверить, не было ли в базе части ответа']
        : ['check', 'ответил: проверить, что не додумал недостающее'];

    case 'answer':
      if (answer.status === 'unknown') {
        return ['fail', filtered ? 'ошибочно отсеян как вопрос не по теме' : 'отказал, хотя ответ в базе есть'];
      }

      return answer.sources.some((s): boolean => isExpected(s.chunk_id))
        ? ['pass', 'ответил по нужным параграфам']
        : ['check', 'ответил, но по другим параграфам'];
  }
}

/** Оценки сходства, по которым выбирают порог. */
export class ScoreStats {
  /** Нужные куски у вопросов, где ответ есть. */
  relevant: number[] = [];
  /** Все куски у вопросов, где ответа нет: их порог должен отсечь. */
  irrelevant: number[] = [];
}

export function collectScores(results: EvalResult[]): ScoreStats {
  const stats: ScoreStats = new ScoreStats();

  for (const result of results) {
    const found: AnswerTraceResult[] = result.answer.trace?.results ?? [];
    const { expected, paragraphs } = result.evalCase;

    if (expected === 'refuse') {
      stats.irrelevant.push(...found.map((r: AnswerTraceResult): number => r.score));
    } else if (expected === 'answer' || expected === 'partial') {
      stats.relevant.push(
        ...found
          .filter((r: AnswerTraceResult): boolean =>
            paragraphs.includes(paragraphOf(r.chunk_id) ?? ''),
          )
          .map((r: AnswerTraceResult): number => r.score),
      );
    }
  }

  return stats;
}

/**
 * Порог посередине между худшим нужным куском и лучшим ненужным,
 * если они не пересекаются. Иначе порогом их не разделить: null.
 */
export function suggestThreshold(stats: ScoreStats): number | null {
  if (stats.relevant.length === 0 || stats.irrelevant.length === 0) {
    return null;
  }

  const lowestRelevant: number = Math.min(...stats.relevant);
  const highestIrrelevant: number = Math.max(...stats.irrelevant);

  if (lowestRelevant <= highestIrrelevant) {
    return null;
  }

  return Math.round(((lowestRelevant + highestIrrelevant) / 2) * 100) / 100;
}
