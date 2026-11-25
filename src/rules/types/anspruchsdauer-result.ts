export class AnspruchsdauerResult {
  /** Месяцы работы со взносами в окне подсчёта (5 лет). */
  countedMonths: number;
  /** На сколько месяцев положено пособие по названным местам работы. 0: меньше минимума. */
  benefitMonths: number;
  /** Самый долгий срок для этого возраста. */
  maxForAge: number;
  /** Сколько месяцев работы нужно для maxForAge. */
  monthsForMax: number;
}
