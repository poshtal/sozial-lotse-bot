import { EmploymentPeriod } from './types/employment-period';
import { AnwartschaftParams } from './types/anwartschaft-params';
import { AnwartschaftResult } from './types/anwartschaft-result';
import { addDays, addMonths, DAY_MS, toUtcDay } from './date.utils';

/**
 * Проверяет стаж для Arbeitslosengeld (Anwartschaftszeit).
 *
 * Чистая функция: результат зависит только от аргументов.
 * Здесь нет ни LLM, ни базы знаний, поэтому её легко проверить тестами.
 *
 * @param periods периоды работы со страховыми взносами
 * @param referenceDate первый день без работы
 * @param params числа из закона (data/rules.json)
 */
export function checkAnwartschaft(
  periods: EmploymentPeriod[],
  referenceDate: Date,
  params: AnwartschaftParams,
): AnwartschaftResult {
  const reference: Date = toUtcDay(referenceDate);

  // Rahmenfrist: последние frameMonths месяцев до первого дня без работы.
  const frameStart: Date = addMonths(reference, -params.frameMonths);
  const frameEnd: Date = addDays(reference, -1);

  const countedDays: number = countDaysInsideFrame(
    periods,
    frameStart,
    frameEnd,
  );
  const requiredDays: number = params.requiredMonths * params.daysPerMonth;
  const missingDays: number = Math.max(0, requiredDays - countedDays);

  const result: AnwartschaftResult = new AnwartschaftResult();
  result.fulfilled = missingDays === 0;
  result.countedDays = countedDays;
  result.countedMonths = Math.floor(countedDays / params.daysPerMonth);
  result.requiredDays = requiredDays;
  result.missingDays = missingDays;
  result.missingMonths = Math.ceil(missingDays / params.daysPerMonth);
  result.frameStart = frameStart;
  result.frameEnd = frameEnd;
  return result;
}

function countDaysInsideFrame(
  periods: EmploymentPeriod[],
  frameStart: Date,
  frameEnd: Date,
): number {
  // 1. Обрезаем каждый период по границам Rahmenfrist.
  const clipped: EmploymentPeriod[] = [];

  for (const period of periods) {
    const start: number = Math.max(
      toUtcDay(period.start).getTime(),
      frameStart.getTime(),
    );
    const end: number = Math.min(
      toUtcDay(period.end).getTime(),
      frameEnd.getTime(),
    );

    if (start <= end) {
      clipped.push({ start: new Date(start), end: new Date(end) });
    }
  }

  // 2. Сортируем по началу, чтобы склеить пересекающиеся периоды.
  clipped.sort(
    (p1: EmploymentPeriod, p2: EmploymentPeriod): number =>
      p1.start.getTime() - p2.start.getTime(),
  );

  // 3. Считаем дни. Две работы в один и тот же день дают один день стажа.
  let days: number = 0;
  let countedUntil: number = -Infinity;

  for (const period of clipped) {
    const start: number = Math.max(
      period.start.getTime(),
      countedUntil + DAY_MS,
    );
    const end: number = period.end.getTime();

    if (start <= end) {
      days += Math.round((end - start) / DAY_MS) + 1;
      countedUntil = end;
    }
  }

  return days;
}
