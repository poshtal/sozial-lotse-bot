import { addDays } from '../rules/date.utils';

/**
 * Разбирает дату, написанную по-человечески:
 *   07.11.2026, 7.11.26, 07/11/2026, 2026-11-07, 7.11
 *   7 ноября, 7 ноября 2026, 7 ноября этого года, 7-го ноября прошлого года
 *   сегодня, вчера, позавчера
 *
 * Месяцы понимает на русском, украинском и немецком.
 * Если год не указан, берётся ближайшая такая дата в прошлом:
 * бот спрашивает только о том, что уже случилось.
 *
 * Это обычный код без LLM: результат всегда один и тот же и покрыт тестами.
 * Возвращает null, если дату разобрать не удалось.
 */
export function parseHumanDate(text: string, today: Date): Date | null {
  const input: string = text
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!]+$/, '')
    .replace(/\s+/g, ' ');

  if (input === '') {
    return null;
  }

  return (
    parseRelativeWord(input, today) ??
    parseIsoDate(input) ??
    parseNumericDate(input, today) ??
    parseDateWithMonthName(input, today)
  );
}

function parseRelativeWord(input: string, today: Date): Date | null {
  switch (input) {
    case 'сегодня':
      return today;
    case 'вчера':
      return addDays(today, -1);
    case 'позавчера':
      return addDays(today, -2);
    default:
      return null;
  }
}

/** 2026-11-07 */
function parseIsoDate(input: string): Date | null {
  const match: RegExpMatchArray | null = input.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  );

  return match
    ? buildDate(Number(match[1]), Number(match[2]), Number(match[3]))
    : null;
}

/** 07.11.2026, 7/11/26, 7-11-2026, 7.11 */
function parseNumericDate(input: string, today: Date): Date | null {
  const match: RegExpMatchArray | null = input.match(
    /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}|\d{2}))?\.?$/,
  );

  if (!match) {
    return null;
  }

  const day: number = Number(match[1]);
  const month: number = Number(match[2]);

  return match[3]
    ? buildDate(expandYear(Number(match[3])), month, day)
    : nearestPastDate(month, day, today);
}

/** 7 ноября, 7-го ноября 2026 года, 7 ноября этого года, 7. November 2026 */
function parseDateWithMonthName(input: string, today: Date): Date | null {
  const match: RegExpMatchArray | null = input.match(
    /^(\d{1,2})(?:-?(?:го|е|ого))?\.? ([a-zа-яіїєґä]+)\.?(?: (.+))?$/,
  );

  if (!match) {
    return null;
  }

  const day: number = Number(match[1]);
  const month: number | null = findMonth(match[2]);

  if (!month) {
    return null;
  }

  const tail: string = (match[3] ?? '').replace(/ ?(года|год|г|року|рік)\.?$/, '');
  const currentYear: number = today.getUTCFullYear();

  if (tail === '') {
    return nearestPastDate(month, day, today);
  }

  if (/^(в )?(этого|этом|текущего|цього|цьому)$/.test(tail)) {
    return buildDate(currentYear, month, day);
  }

  if (/^(в )?(прошлого|прошлом|минулого|минулому)$/.test(tail)) {
    return buildDate(currentYear - 1, month, day);
  }

  return /^(\d{4}|\d{2})$/.test(tail)
    ? buildDate(expandYear(Number(tail)), month, day)
    : null;
}

/**
 * Начала названий месяцев. Порядок важен: «мар» (март) проверяется раньше
 * «ма» (май), иначе март превратился бы в май.
 */
const MONTH_STEMS: [string, number][] = [
  // русский
  ['янв', 1], ['фев', 2], ['мар', 3], ['апр', 4], ['май', 5], ['мая', 5],
  ['мае', 5], ['июн', 6], ['июл', 7], ['авг', 8], ['сен', 9], ['окт', 10],
  ['ноя', 11], ['дек', 12],
  // украинский
  ['січ', 1], ['лют', 2], ['бер', 3], ['кві', 4], ['тра', 5], ['чер', 6],
  ['лип', 7], ['сер', 8], ['вер', 9], ['жов', 10], ['лис', 11], ['гру', 12],
  // немецкий
  ['jan', 1], ['feb', 2], ['mär', 3], ['mar', 3], ['apr', 4], ['mai', 5],
  ['jun', 6], ['jul', 7], ['aug', 8], ['sep', 9], ['okt', 10], ['nov', 11],
  ['dez', 12],
];

function findMonth(word: string): number | null {
  for (const [stem, month] of MONTH_STEMS) {
    if (word.startsWith(stem)) {
      return month;
    }
  }

  return null;
}

/** Год не указан: берём этот год, а если дата ещё не наступила, прошлый. */
function nearestPastDate(month: number, day: number, today: Date): Date | null {
  const thisYear: Date | null = buildDate(today.getUTCFullYear(), month, day);

  if (thisYear && thisYear.getTime() <= today.getTime()) {
    return thisYear;
  }

  return buildDate(today.getUTCFullYear() - 1, month, day);
}

/** 26 превращается в 2026. */
function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

/** Возвращает null для несуществующих дат вроде 31 февраля. */
function buildDate(year: number, month: number, day: number): Date | null {
  const date: Date = new Date(Date.UTC(year, month - 1, day));

  const isRealDate: boolean =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isRealDate ? date : null;
}
