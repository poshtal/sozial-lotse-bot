import { parseGermanDate } from '../rules/date.utils';
import { parseHumanDate } from './human-date.parser';
import { parsePeriods } from './periods.parser';

const TODAY: Date = parseGermanDate('15.11.2026') as Date;
const d = (text: string): Date => parseGermanDate(text) as Date;

describe('parseHumanDate', () => {
  it.each([
    ['07.11.2026', '07.11.2026'],
    ['7.11.26', '07.11.2026'],
    ['07/11/2026', '07.11.2026'],
    ['7-11-2026', '07.11.2026'],
    ['2026-11-07', '07.11.2026'],
    ['7 ноября этого года', '07.11.2026'],
    ['7 ноября', '07.11.2026'],
    ['7 ноября 2025', '07.11.2025'],
    ['7-го ноября 2025 года', '07.11.2025'],
    ['7 ноября прошлого года', '07.11.2025'],
    ['  7 Ноября 2026 г. ', '07.11.2026'],
    ['1 марта 2026', '01.03.2026'],
    ['1 мая 2026', '01.05.2026'],
    ['7 листопада 2025', '07.11.2025'],
    ['7. November 2025', '07.11.2025'],
    ['1 März 2026', '01.03.2026'],
    ['сегодня', '15.11.2026'],
    ['вчера', '14.11.2026'],
  ])('%s', (input: string, expected: string) => {
    expect(parseHumanDate(input, TODAY)).toEqual(d(expected));
  });

  it('без года берёт ближайшую прошедшую дату', () => {
    // 20 декабря в этом году ещё не наступило, значит речь о прошлом годе.
    expect(parseHumanDate('20 декабря', TODAY)).toEqual(d('20.12.2025'));
    expect(parseHumanDate('20.12', TODAY)).toEqual(d('20.12.2025'));
    expect(parseHumanDate('15.11', TODAY)).toEqual(d('15.11.2026'));
  });

  it.each([
    'в июле',
    'ноябрь',
    '31 февраля 2026',
    '32.01.2026',
    '7 чегонибудь 2026',
    'привет',
    '',
    '7 ноября какого-то года',
  ])('не выдумывает дату из «%s»', (input: string) => {
    expect(parseHumanDate(input, TODAY)).toBeNull();
  });
});

describe('parsePeriods', () => {
  it.each([
    '15.08.2024 - 30.09.2024',
    '15.08.2024-30.09.2024',
    '15.08.2024 — 30.09.2024',
    'с 15 августа 2024 по 30 сентября 2024',
    'С 15.08.2024 до 30.09.2024',
    '15-08-2024 - 30-09-2024',
  ])('%s', (line: string) => {
    const result = parsePeriods(line, TODAY);

    expect(result.error).toBeUndefined();
    expect(result.periods).toEqual([
      { start: d('15.08.2024'), end: d('30.09.2024') },
    ]);
  });

  it('«сейчас» и «по сей день» означают сегодня', () => {
    expect(parsePeriods('01.03.2026 - сейчас', TODAY).periods[0].end).toEqual(TODAY);
    expect(parsePeriods('с 1 марта 2026 по сей день', TODAY).periods[0].end).toEqual(TODAY);
  });

  it('объясняет, какую строку не понял', () => {
    const result = parsePeriods('15.08.2024 - 30.09.2024\nпотом ещё полгода', TODAY);

    expect(result.error).toContain('потом ещё полгода');
    expect(result.periods).toEqual([]);
  });
});
