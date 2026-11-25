import { readFileSync } from 'fs';
import { join } from 'path';
import { calculateAnspruchsdauer } from './anspruchsdauer.rule';
import { AnspruchsdauerParams } from './types/anspruchsdauer-params';
import { EmploymentPeriod } from './types/employment-period';

/** Числа берутся из настоящего data/rules.json: тест проверяет и их. */
const PARAMS: AnspruchsdauerParams = JSON.parse(
  readFileSync(join(process.cwd(), 'data', 'rules.json'), 'utf-8'),
).anspruchsdauer;

const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const period = (start: string, end: string): EmploymentPeriod => ({
  start: day(start),
  end: day(end),
});

/** Первый день без работы: 01.01.2026. Работа подряд N месяцев до этого. */
const REFERENCE: Date = day('2026-01-01');
const monthsBefore = (months: number): EmploymentPeriod[] => {
  // 30 дней на месяц, как считает закон, плюс запас в один день.
  const start: Date = new Date(REFERENCE.getTime() - (months * 30 + 1) * 86_400_000);
  return [{ start, end: day('2025-12-31') }];
};

describe('calculateAnspruchsdauer: таблица § 147 Abs. 2', () => {
  it.each([
    // месяцев работы, нижняя граница возраста, ожидаемый срок
    [11, 0, 0],
    [12, 0, 6],
    [15, 0, 6],
    [16, 0, 8],
    [20, 0, 10],
    [24, 0, 12],
    [48, 0, 12], // до 50 больше 12 месяцев не бывает
    [30, 50, 15],
    [36, 50, 15], // 18 месяцев только с 55
    [36, 55, 18],
    [48, 55, 18],
    [48, 58, 24],
    [29, 58, 12], // возраст есть, а стажа на 15 месяцев не хватает
  ])('%i мес. работы, возраст от %i → %i мес. пособия', (worked, minAge, expected) => {
    const result = calculateAnspruchsdauer(monthsBefore(worked), REFERENCE, minAge, PARAMS);

    expect(result.countedMonths).toBe(worked);
    expect(result.benefitMonths).toBe(expected);
  });

  it('называет максимум для возраста и сколько работы для него нужно', () => {
    const under50 = calculateAnspruchsdauer([], REFERENCE, 0, PARAMS);
    expect([under50.maxForAge, under50.monthsForMax]).toEqual([12, 24]);

    const from55 = calculateAnspruchsdauer([], REFERENCE, 55, PARAMS);
    expect([from55.maxForAge, from55.monthsForMax]).toEqual([18, 36]);
  });

  it('считает работу за 5 лет, а не за 2,5 года', () => {
    // Работа 3–4 года назад попадает в окно § 147, хотя для стажа § 142 уже не считается.
    const result = calculateAnspruchsdauer(
      [period('2022-03-01', '2023-02-28'), period('2024-07-01', '2025-12-31')],
      REFERENCE,
      50,
      PARAMS,
    );

    expect(result.countedMonths).toBe(30);
    expect(result.benefitMonths).toBe(15);
  });

  it('работа больше 5 лет назад не считается', () => {
    const result = calculateAnspruchsdauer([period('2019-01-01', '2020-12-31')], REFERENCE, 0, PARAMS);

    expect(result.countedMonths).toBe(0);
  });

  it('реальные даты из ТЗ: 13 месяцев, до 50 лет → 6 месяцев, до максимума далеко', () => {
    const result = calculateAnspruchsdauer(
      [period('2024-07-01', '2024-08-15'), period('2024-11-11', '2025-08-01'), period('2025-10-28', '2026-01-17')],
      day('2026-01-18'),
      0,
      PARAMS,
    );

    expect(result.countedMonths).toBe(13);
    expect(result.benefitMonths).toBe(6);
    expect(result.maxForAge).toBe(12);
  });
});
