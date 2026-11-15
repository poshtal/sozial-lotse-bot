import { EmploymentPeriod } from '../rules/types/employment-period';
import { MAX_PERIODS, TEXT_NO_JOBS_WORDS } from './constants/conversation.constants';
import { parseHumanDate } from './human-date.parser';

export class PeriodsParseResult {
  periods: EmploymentPeriod[] = [];
  /**
   * true, если в какой-то строке было только начало, и конец бот подставил
   * сам. Такое предположение нужно показать человеку и переспросить.
   */
  assumedEnd: boolean = false;
  /** Текст ошибки для человека. Пусто, если всё разобрано. */
  error?: string;
}

/** Слова, которые означают «работаю там до сих пор». */
const NOW_WORDS: string[] = ['сейчас', 'сегодня'];

/** Обороты с тем же смыслом. Перед разбором заменяются на «по сейчас». */
const NOW_PHRASES: RegExp =
  /\s+(по сей день|до сих пор|по настоящее время|по сегодняшний день)$/;

/**
 * Разбирает список мест работы, по одному в строке:
 *   15.08.2024 - 30.09.2024
 *   с 1 ноября 2024 по 1 июля 2025
 *   01.11.2024 — сейчас
 *   с 1 июля 2024          (только начало: концом становится assumedEndDate)
 *
 * Запасной разбор без LLM. Когда подключится модель, она будет понимать
 * и совсем свободный текст, а этот код останется на случай её недоступности.
 */
export function parsePeriods(
  text: string,
  today: Date,
  assumedEndDate: Date = today,
): PeriodsParseResult {
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
    let period: EmploymentPeriod | null = parseOnePeriod(line, today);

    // Вся строка это одна дата: человек написал только начало работы.
    if (!period) {
      const startOnly: Date | null = parseHumanDate(line, today);

      if (startOnly) {
        period = { start: startOnly, end: assumedEndDate };
        result.assumedEnd = true;
      }
    }

    if (!period) {
      result.error = `Не смог разобрать строку «${line}». Напиши начало и конец, например: 15.08.2024 - 30.09.2024 или «с 15 августа 2024 по 30 сентября 2024».`;
      result.periods = [];
      result.assumedEnd = false;
      return result;
    }

    if (period.start.getTime() > period.end.getTime()) {
      result.error = `В строке «${line}» начало позже конца. Проверь даты, пожалуйста.`;
      result.periods = [];
      result.assumedEnd = false;
      return result;
    }

    result.periods.push(period);
  }

  return result;
}

function parseOnePeriod(line: string, today: Date): EmploymentPeriod | null {
  const text: string = line
    .trim()
    .toLowerCase()
    .replace(/^(с|со|от) /, '')
    .replace(NOW_PHRASES, ' по сейчас');

  // Способы разделить строку на начало и конец, от самого явного к спорному.
  // Простой дефис стоит последним: он бывает и внутри даты (7-11-2026).
  const separators: RegExp[] = [
    /\s*[–—]\s*/,
    /\s+(?:и\s+)?(?:по|до)\s+/,
    /\s+-\s+/,
    /-/,
  ];

  for (const separator of separators) {
    const parts: string[] = text.split(separator);

    if (parts.length !== 2) {
      continue;
    }

    const start: Date | null = parseHumanDate(parts[0], today);
    const end: Date | null = NOW_WORDS.includes(parts[1].trim())
      ? today
      : parseHumanDate(parts[1], today);

    if (start && end) {
      return { start, end };
    }
  }

  return null;
}
