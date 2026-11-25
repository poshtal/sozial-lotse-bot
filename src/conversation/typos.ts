/**
 * Исправляет опечатки в словах, из которых состоят даты: «1 июля 24 гора»
 * превращается в «1 июля 24 года», «7 нрября» в «7 ноября».
 *
 * Правило осторожное:
 * - исправляется только слово из 4 и больше букв;
 * - только если оно отличается от известного слова на одну букву
 *   (лишняя, пропущенная, другая или две соседние переставлены);
 * - только если такое известное слово одно. «июдя» одинаково близко
 *   к «июня» и к «июля», поэтому не исправляется: бот переспросит.
 *
 * Бот всё равно показывает, как понял даты («Записал: ...»), так что
 * человек увидит исправление и сможет поправить.
 */
const KNOWN_WORDS: string[] = [
  // русские месяцы, как их пишут в датах
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
  'сентября', 'октября', 'ноября', 'декабря',
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август',
  'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
  // украинские месяцы
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня',
  'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
  // немецкие месяцы
  'januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august',
  'september', 'oktober', 'november', 'dezember',
  // остальные слова в датах
  'года', 'року', 'этого', 'прошлого', 'текущего', 'минулого', 'цього',
  'сегодня', 'вчера', 'позавчера', 'сейчас',
];

const MIN_WORD_LENGTH: number = 4;

export function fixTypos(text: string): string {
  return text.replace(/[a-zа-яёіїєґäöüß]+/gi, (word: string): string => {
    const lower: string = word.toLowerCase();

    if (lower.length < MIN_WORD_LENGTH || KNOWN_WORDS.includes(lower)) {
      return word;
    }

    const candidates: string[] = KNOWN_WORDS.filter(
      (known: string): boolean => isOneEditAway(lower, known),
    );

    return candidates.length === 1 ? candidates[0] : word;
  });
}

/** Отличаются ли слова ровно на одну правку (расстояние Дамерау–Левенштейна 1). */
export function isOneEditAway(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) {
    return false;
  }

  if (a.length === b.length) {
    const diff: number[] = [];

    for (let i: number = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diff.push(i);
      }
    }

    // Одна буква другая: «гора» и «года».
    if (diff.length === 1) {
      return true;
    }

    // Две соседние буквы переставлены: «окятбря» и «октября».
    return (
      diff.length === 2 &&
      diff[1] === diff[0] + 1 &&
      a[diff[0]] === b[diff[1]] &&
      a[diff[1]] === b[diff[0]]
    );
  }

  // Одна буква лишняя или пропущена: «сентбря» и «сентября».
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];

  for (let i: number = 0; i < longer.length; i++) {
    if (shorter === longer.slice(0, i) + longer.slice(i + 1)) {
      return true;
    }
  }

  return false;
}
