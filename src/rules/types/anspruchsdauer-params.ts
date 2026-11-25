/** Одна строка таблицы § 147 Abs. 2 SGB III. */
export class AnspruchsdauerRow {
  /** Сколько месяцев работы со взносами нужно. */
  insuredMonths: number;
  /** С какого полного возраста строка действует. 0: с любого. */
  minAge: number;
  /** На сколько месяцев положено пособие. */
  benefitMonths: number;
}

/** Числа из закона для срока пособия. Лежат в data/rules.json. */
export class AnspruchsdauerParams {
  /** Окно подсчёта: Rahmenfrist, расширенная на 30 месяцев (§ 147 Abs. 1). */
  frameMonths: number;
  /** Сколько дней считается за месяц (§ 339 SGB III). */
  daysPerMonth: number;
  /** Нижняя граница возраста для каждой кнопки анкеты: "50to54" → 50. */
  ageGroups: Record<string, number>;
  table: AnspruchsdauerRow[];
}
