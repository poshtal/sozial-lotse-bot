/**
 * Отбор параграфов по номерам: "136-164,81-87,38".
 * "§ 142a" относится к номеру 142.
 * Пустая строка означает «все параграфы».
 */
export function createParagraphFilter(
  spec: string | undefined,
): (label: string) => boolean {
  const text: string = (spec ?? '').trim();

  if (text === '') {
    return (): boolean => true;
  }

  const ranges: [number, number][] = text.split(',').map((part: string) => {
    const match: RegExpMatchArray | null = part
      .trim()
      .match(/^(\d+)(?:\s*-\s*(\d+))?$/);

    if (!match) {
      throw new Error(
        `Не понял номера параграфов «${part.trim()}». Пример: 136-164,81-87,38`,
      );
    }

    const from: number = Number(match[1]);
    const to: number = match[2] ? Number(match[2]) : from;
    return [Math.min(from, to), Math.max(from, to)];
  });

  return (label: string): boolean => {
    const match: RegExpMatchArray | null = label.match(/(\d+)/);

    if (!match) {
      return false;
    }

    const number: number = Number(match[1]);
    return ranges.some(([from, to]): boolean => number >= from && number <= to);
  };
}
