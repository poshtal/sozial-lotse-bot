import { EmploymentPeriod } from '../rules/types/employment-period';
import { parseGermanDate } from '../rules/date.utils';
import {
  MAX_PERIODS,
  NOW_WORD,
  TEXT_NO_JOBS_WORDS,
} from './constants/conversation.constants';

export class PeriodsParseResult {
  periods: EmploymentPeriod[] = [];
  /** Текст ошибки для человека. Пусто, если всё разобрано. */
  error?: string;
}

/**
 * Разбирает ответ вида:
 *   15.08.2024 - 30.09.2024
 *   01.11.2024 - сейчас
 *
 * Временное решение для консольного среза. Когда подключится LLM,
 * человек сможет писать свободным текстом, а этот разбор останется
 * запасным вариантом.
 */
export function parsePeriods(text: string, today: Date): PeriodsParseResult {
  const result: PeriodsParseResult = new PeriodsParseResult();
  const normalized: string = text.trim().toLowerCase();

  if (TEXT_NO_JOBS_WORDS.includes(normalized)) {
    return result;
  }

  const lines: string[] = text
    .split(/[\n;]+/)
    .map((line: string): string => line.trim())
    .filter((line: string): boolean => line !== '');

  if (lines.length === 0) {
    result.error = 'Напиши хотя бы одно место работы или слово «нет».';
    return result;
  }

  if (lines.length > MAX_PERIODS) {
    result.error = `Слишком много строк. Хватит ${MAX_PERIODS} последних мест работы.`;
    return result;
  }

  for (const line of lines) {
    const parts: string[] = line.split(/\s*[-–—]\s*/);
    const start: Date | null =
      parts.length === 2 ? parseGermanDate(parts[0]) : null;
    const end: Date | null =
      parts.length !== 2
        ? null
        : parts[1].toLowerCase() === NOW_WORD
          ? today
          : parseGermanDate(parts[1]);

    if (!start || !end) {
      result.error = `Не смог разобрать строку «${line}». Нужен вид: 15.08.2024 - 30.09.2024`;
      result.periods = [];
      return result;
    }

    if (start.getTime() > end.getTime()) {
      result.error = `В строке «${line}» начало позже конца. Проверь даты, пожалуйста.`;
      result.periods = [];
      return result;
    }

    result.periods.push({ start, end });
  }

  return result;
}
