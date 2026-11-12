export const DAY_MS: number = 24 * 60 * 60 * 1000;

/** Отбрасывает время: остаётся полночь по UTC того же календарного дня. */
export function toUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Сдвигает дату на целое число месяцев (можно отрицательное).
 * Если в целевом месяце нет такого числа (31 марта минус месяц),
 * берётся последний день этого месяца.
 */
export function addMonths(date: Date, months: number): Date {
  const year: number = date.getUTCFullYear();
  const month: number = date.getUTCMonth() + months;
  const day: number = date.getUTCDate();

  const lastDayOfTargetMonth: number = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}

/** Разбирает дату вида 01.07.2025. Возвращает null, если такой даты нет. */
export function parseGermanDate(text: string): Date | null {
  const match: RegExpMatchArray | null = text
    .trim()
    .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (!match) {
    return null;
  }

  const day: number = Number(match[1]);
  const month: number = Number(match[2]);
  const year: number = Number(match[3]);
  const date: Date = new Date(Date.UTC(year, month - 1, day));

  const isRealDate: boolean =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return isRealDate ? date : null;
}

export function formatGermanDate(date: Date): string {
  const day: string = String(date.getUTCDate()).padStart(2, '0');
  const month: string = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getUTCFullYear()}`;
}
