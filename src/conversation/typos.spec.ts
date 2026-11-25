import { parsePeriods } from './periods.parser';
import { fixTypos, isOneEditAway } from './typos';

describe('fixTypos', () => {
  it.each([
    ['1 июля 24 гора', '1 июля 24 года'],
    ['7 нрября', '7 ноября'],
    ['с 1 сентбря 2024', 'с 1 сентября 2024'],
    ['15 окятбря', '15 октября'],
    ['01.11.2024 - сечас', '01.11.2024 - сейчас'],
    ['3 Dezmber', '3 dezember'],
  ])('«%s» → «%s»', (input, expected) => {
    expect(fixTypos(input)).toBe(expected);
  });

  it('не трогает правильные слова и числа', () => {
    expect(fixTypos('с 1 ноября 2024 по 1 июля 2025')).toBe('с 1 ноября 2024 по 1 июля 2025');
    expect(fixTypos('15.08.2024 - 30.09.2024')).toBe('15.08.2024 - 30.09.2024');
  });

  it('не исправляет, если слово одинаково близко к двум месяцам', () => {
    // «июдя» отличается на одну букву и от «июня», и от «июля».
    expect(fixTypos('5 июдя')).toBe('5 июдя');
  });

  it('не трогает короткие слова и слова, далёкие от известных', () => {
    expect(fixTypos('по до с')).toBe('по до с');
    expect(fixTypos('работаю там')).toBe('работаю там');
  });
});

describe('isOneEditAway', () => {
  it.each([
    ['гора', 'года', true],
    ['сентбря', 'сентября', true],
    ['окятбря', 'октября', true],
    ['года', 'года', false],
    ['гиря', 'года', false],
    ['го', 'года', false],
  ])('%s / %s → %s', (a, b, expected) => {
    expect(isOneEditAway(a, b)).toBe(expected);
  });
});

describe('опечатки в списке мест работы', () => {
  const today: Date = new Date(Date.UTC(2026, 10, 25));

  it('случай из живого теста: «1 июля 24 гора» понимается как начало работы', () => {
    const result = parsePeriods('1 июля 24 гора', today, new Date(Date.UTC(2026, 10, 6)));

    expect(result.error).toBeUndefined();
    expect(result.assumedEnd).toBe(true);
    expect(result.periods[0].start).toEqual(new Date(Date.UTC(2024, 6, 1)));
  });

  it('опечатка в «сейчас» тоже исправляется', () => {
    const result = parsePeriods('01.11.2024 - сечас', today);

    expect(result.error).toBeUndefined();
    expect(result.periods[0].end).toEqual(today);
  });
});
