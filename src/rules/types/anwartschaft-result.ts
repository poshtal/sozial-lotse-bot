export class AnwartschaftResult {
  fulfilled: boolean;
  countedDays: number;
  /** Засчитанные дни в целых месяцах, округление вниз. */
  countedMonths: number;
  requiredDays: number;
  missingDays: number;
  /** Недостающие дни, округлённые вверх до целых месяцев. */
  missingMonths: number;
  /** Первый и последний день Rahmenfrist, оба включительно. */
  frameStart: Date;
  frameEnd: Date;
}
