import { checkAnwartschaft } from './anwartschaft.rule';
import { addMonths, parseGermanDate } from './date.utils';
import { AnwartschaftParams } from './types/anwartschaft-params';
import { EmploymentPeriod } from './types/employment-period';

const PARAMS: AnwartschaftParams = {
  requiredMonths: 12,
  frameMonths: 30,
  daysPerMonth: 30,
};

function date(text: string): Date {
  const parsed: Date | null = parseGermanDate(text);
  if (!parsed) {
    throw new Error(`Bad test date ${text}`);
  }
  return parsed;
}

function period(start: string, end: string): EmploymentPeriod {
  return { start: date(start), end: date(end) };
}

describe('checkAnwartschaft', () => {
  // История автора проекта. Даты примерные: заменить на настоящие.
  const firstJob: EmploymentPeriod = period('15.08.2024', '30.09.2024');
  const secondJob: EmploymentPeriod = period('01.11.2024', '01.07.2025');
  const seasonalJob: EmploymentPeriod = period('20.10.2025', '05.01.2026');

  it('история автора: после двух работ стажа не хватает', () => {
    const result = checkAnwartschaft(
      [firstJob, secondJob],
      date('02.07.2025'),
      PARAMS,
    );

    expect(result.countedDays).toBe(47 + 243);
    expect(result.fulfilled).toBe(false);
    expect(result.missingDays).toBe(70);
    expect(result.missingMonths).toBe(3);
  });

  it('история автора: короткий сезонный контракт закрывает недостающий срок', () => {
    const result = checkAnwartschaft(
      [firstJob, secondJob, seasonalJob],
      date('06.01.2026'),
      PARAMS,
    );

    expect(result.countedDays).toBe(47 + 243 + 78);
    expect(result.fulfilled).toBe(true);
    expect(result.missingDays).toBe(0);
  });

  it('ровно 360 дней достаточно, 359 нет', () => {
    const reference: Date = date('01.01.2026');

    const enough = checkAnwartschaft(
      [period('06.01.2025', '31.12.2025')],
      reference,
      PARAMS,
    );
    const notEnough = checkAnwartschaft(
      [period('07.01.2025', '31.12.2025')],
      reference,
      PARAMS,
    );

    expect(enough.countedDays).toBe(360);
    expect(enough.fulfilled).toBe(true);
    expect(notEnough.countedDays).toBe(359);
    expect(notEnough.fulfilled).toBe(false);
    expect(notEnough.missingMonths).toBe(1);
  });

  it('работа до начала Rahmenfrist не считается', () => {
    const result = checkAnwartschaft(
      [period('01.01.2020', '31.12.2021')],
      date('01.01.2026'),
      PARAMS,
    );

    expect(result.countedDays).toBe(0);
  });

  it('период обрезается по границам Rahmenfrist', () => {
    // Rahmenfrist: 01.07.2023 - 31.12.2025
    const result = checkAnwartschaft(
      [period('01.06.2023', '10.07.2023')],
      date('01.01.2026'),
      PARAMS,
    );

    expect(result.frameStart).toEqual(date('01.07.2023'));
    expect(result.frameEnd).toEqual(date('31.12.2025'));
    expect(result.countedDays).toBe(10);
  });

  it('две работы в одни и те же дни не удваивают стаж', () => {
    const result = checkAnwartschaft(
      [period('01.03.2025', '31.03.2025'), period('15.03.2025', '15.04.2025')],
      date('01.01.2026'),
      PARAMS,
    );

    expect(result.countedDays).toBe(46);
  });

  it('без работы стаж равен нулю', () => {
    const result = checkAnwartschaft([], date('01.01.2026'), PARAMS);

    expect(result.countedDays).toBe(0);
    expect(result.missingMonths).toBe(12);
  });
});

describe('date utils', () => {
  it('addMonths берёт последний день месяца, если числа нет', () => {
    expect(addMonths(date('31.03.2025'), -1)).toEqual(date('28.02.2025'));
    expect(addMonths(date('31.08.2025'), -30)).toEqual(date('28.02.2023'));
  });

  it('parseGermanDate отклоняет несуществующие даты', () => {
    expect(parseGermanDate('31.02.2025')).toBeNull();
    expect(parseGermanDate('2025-07-01')).toBeNull();
    expect(parseGermanDate('1.7.2025')).toEqual(date('01.07.2025'));
  });
});
