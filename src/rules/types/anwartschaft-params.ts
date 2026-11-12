/** Числа из закона. Лежат в data/rules.json, а не в коде. */
export class AnwartschaftParams {
  /** Сколько месяцев стажа нужно (§ 142 SGB III). */
  requiredMonths: number;
  /** Длина Rahmenfrist в месяцах (§ 143 SGB III). */
  frameMonths: number;
  /** Сколько дней считается за месяц (§ 339 SGB III). */
  daysPerMonth: number;
}
