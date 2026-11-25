import { AnswerTraceResult } from '../answer/types/answer';
import {
  collectScores,
  EvalResult,
  paragraphOf,
  ScoreStats,
  suggestThreshold,
  Verdict,
} from './evaluation';

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: 'да',
  fail: 'НЕТ',
  check: 'проверить',
};

const EXPECTED_LABEL: Record<string, string> = {
  answer: 'ответить',
  refuse: 'отказать',
  partial: 'частично',
  out_of_scope: 'отсеять',
};

const STATUS_LABEL: Record<string, string> = {
  answered: 'ответил',
  unknown: 'не умею',
  failed: 'сбой',
};

/** Отчёт в Markdown: сводка, таблица, подробности по каждому вопросу. */
export function buildReport(
  results: EvalResult[],
  minScore: number,
  date: string,
): string {
  const lines: string[] = [];
  const count = (v: Verdict): number => results.filter((r) => r.verdict === v).length;

  lines.push(`# Проверка качества ответов, ${date}`, '');
  lines.push(`Вопросов: ${results.length}. Порог сходства: ${minScore}.`, '');
  lines.push(
    `Совпало с ожиданием: **${count('pass')}**, не совпало: **${count('fail')}**, ` +
      `проверить глазами: **${count('check')}**.`,
    '',
  );

  const withParagraphs: EvalResult[] = results.filter(
    (r) => r.evalCase.paragraphs.length > 0 && (r.answer.trace?.results.length ?? 0) > 0,
  );

  if (withParagraphs.length > 0) {
    const found: number = withParagraphs.filter((r) => r.rank !== null).length;
    lines.push(
      `Поиск: нужный параграф попал в выдачу в ${found} из ${withParagraphs.length} вопросов.`,
      '',
    );
  }

  lines.push(...thresholdSection(collectScores(results), minScore), '');

  lines.push('| № | Вопрос | Ожидание | Бот | Нужный § в поиске | Совпало | Почему |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');

  for (const r of results) {
    const rank: string =
      r.evalCase.paragraphs.length === 0 ? '—' : r.rank === null ? 'нет' : `${r.rank}-е место`;
    lines.push(
      `| ${r.evalCase.id} | ${r.evalCase.question} | ${EXPECTED_LABEL[r.evalCase.expected]} | ` +
        `${STATUS_LABEL[r.status]} | ${rank} | ${VERDICT_LABEL[r.verdict]} | ${r.reason} |`,
    );
  }

  lines.push('');

  for (const r of results) {
    lines.push(...details(r));
  }

  return lines.join('\n');
}

function thresholdSection(stats: ScoreStats, minScore: number): string[] {
  const range = (scores: number[]): string =>
    scores.length === 0
      ? 'нет данных'
      : `${Math.min(...scores).toFixed(3)}–${Math.max(...scores).toFixed(3)}`;

  const lines: string[] = [
    '## Порог',
    '',
    `- Нужные куски (вопросы с ответом): ${range(stats.relevant)}`,
    `- Куски у вопросов без ответа в базе: ${range(stats.irrelevant)}`,
  ];

  const suggested: number | null = suggestThreshold(stats);

  if (suggested !== null) {
    lines.push(`- Порог разделяет их. Предлагаемое значение: **${suggested}** (сейчас ${minScore}).`);
  } else if (stats.relevant.length > 0 && stats.irrelevant.length > 0) {
    lines.push('- Оценки пересекаются: порогом их не разделить, отсев делает модель.');
  }

  return lines;
}

function details(r: EvalResult): string[] {
  const trace = r.answer.trace;
  const lines: string[] = [`## ${r.evalCase.id}. ${r.evalCase.question}`, ''];

  lines.push(`Ожидание: ${EXPECTED_LABEL[r.evalCase.expected]}. ${r.evalCase.note}`);

  if (r.evalCase.paragraphs.length > 0) {
    lines.push(`Нужные параграфы: ${r.evalCase.paragraphs.map((p) => `§ ${p}`).join(', ')}`);
  }

  lines.push('');

  if (!trace) {
    lines.push('Сбой до поиска.', '');
  } else if (!trace.inScope) {
    lines.push('Шаг переписывания: вопрос не по теме, поиск не делался.', '');
  } else {
    lines.push(
      trace.rewritten
        ? `Запрос для поиска: ${trace.query}`
        : 'Переписать не получилось, искали по исходному вопросу.',
      '',
    );
    trace.results.forEach((t: AnswerTraceResult, i: number): void => {
      const mark: string = r.evalCase.paragraphs.includes(paragraphOf(t.chunk_id) ?? '')
        ? ' ← нужный'
        : '';
      lines.push(
        `${i + 1}. ${t.score.toFixed(3)} ${t.passed ? 'проходит' : 'ниже порога'}: ${t.title}${mark}`,
      );
    });
    lines.push('');
  }

  lines.push('Ответ бота:', '');
  lines.push(...r.answer.text.split('\n').map((line: string): string => `> ${line}`));
  lines.push('');
  return lines;
}
