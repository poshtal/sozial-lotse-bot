import { countDaysInsideFrame } from './anwartschaft.rule';
import { addDays, addMonths, toUtcDay } from './date.utils';
import { AnspruchsdauerParams, AnspruchsdauerRow } from './types/anspruchsdauer-params';
import { AnspruchsdauerResult } from './types/anspruchsdauer-result';
import { EmploymentPeriod } from './types/employment-period';

/**
 * Срок Arbeitslosengeld по § 147 SGB III: зависит от месяцев работы со
 * взносами за последние 5 лет и от возраста.
 *
 * Чистая функция, как проверка стажа: без LLM, легко проверить тестами.
 * Не учитывает прежнее пособие (§ 147 Abs. 1 Satz 2 и Abs. 4), сокращение
 * из-за Sperrzeit (§ 148) и короткие контракты (§ 147 Abs. 3): об этом
 * бот говорит словами.
 *
 * @param periods периоды работы со страховыми взносами
 * @param referenceDate первый день без работы
 * @param minAge нижняя граница возрастной группы человека
 */
export function calculateAnspruchsdauer(
  periods: EmploymentPeriod[],
  referenceDate: Date,
  minAge: number,
  params: AnspruchsdauerParams,
): AnspruchsdauerResult {
  const reference: Date = toUtcDay(referenceDate);
  const frameStart: Date = addMonths(reference, -params.frameMonths);
  const frameEnd: Date = addDays(reference, -1);

  const countedMonths: number = Math.floor(
    countDaysInsideFrame(periods, frameStart, frameEnd) / params.daysPerMonth,
  );

  // Строки таблицы, которые действуют для этого возраста.
  const rowsForAge: AnspruchsdauerRow[] = params.table.filter(
    (row: AnspruchsdauerRow): boolean => row.minAge <= minAge,
  );
  const reached: AnspruchsdauerRow[] = rowsForAge.filter(
    (row: AnspruchsdauerRow): boolean => row.insuredMonths <= countedMonths,
  );
  const best = (rows: AnspruchsdauerRow[]): AnspruchsdauerRow | undefined =>
    rows.reduce<AnspruchsdauerRow | undefined>(
      (top, row) => (!top || row.benefitMonths > top.benefitMonths ? row : top),
      undefined,
    );

  const top: AnspruchsdauerRow | undefined = best(rowsForAge);

  const result: AnspruchsdauerResult = new AnspruchsdauerResult();
  result.countedMonths = countedMonths;
  result.benefitMonths = best(reached)?.benefitMonths ?? 0;
  result.maxForAge = top?.benefitMonths ?? 0;
  result.monthsForMax = top?.insuredMonths ?? 0;
  return result;
}
