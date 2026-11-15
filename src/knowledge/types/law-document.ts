/** Один параграф закона, как он записан в официальном XML. */
export class LawParagraph {
  /** Обозначение: "§ 142". */
  label: string;
  /** Название параграфа: "Anwartschaftszeit". */
  title: string;
  /** Глава и раздел, в которых стоит параграф. */
  section: string;
  /** Абзацы текста: "(1) ...", "(2) ...". Таблицы и списки уже развёрнуты. */
  blocks: string[];
}

/** Закон целиком. */
export class LawDocument {
  /** Сокращение закона: "SGB 3". */
  code: string;
  /** Полное название. */
  fullTitle: string;
  /** Редакция: "Zuletzt geändert durch Art. 1a G v. 24.7.2026 I Nr. 228". */
  stand: string;
  paragraphs: LawParagraph[];
}
