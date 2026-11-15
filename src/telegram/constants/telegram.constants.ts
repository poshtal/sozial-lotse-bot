/** Сколько сообщений от одного человека бот принимает за окно. */
export const RATE_LIMIT_MAX_MESSAGES: number = 20;
/** Длина окна, миллисекунды. */
export const RATE_LIMIT_WINDOW_MS: number = 60 * 1000;

export const TEXT_ONLY_TEXT: string =
  'Я пока понимаю только текст. Фото, файлы и голосовые я не открываю и не сохраняю.';
export const TEXT_TOO_FAST: string =
  'Слишком много сообщений подряд. Подожди минуту, и продолжим.';
export const TEXT_INTERNAL_ERROR: string =
  'У меня что-то сломалось. Попробуй ещё раз или напиши /start.';

export const TEXT_CHAT_ERASED: string =
  'Готово. Я стёр твои ответы из своей памяти и убрал нашу переписку из этого чата. Если выше что-то осталось, это старые сообщения: их можно удалить в самом Telegram, через меню чата «Очистить историю».';
export const TEXT_CHAT_NOT_ERASED: string =
  'Твои ответы я стёр из своей памяти, но убрать сообщения из чата не получилось. Их можно удалить в самом Telegram, через меню чата «Очистить историю».';

/** Telegram разрешает боту удалять сообщения не старше 48 часов. */
export const MESSAGE_DELETE_WINDOW_MS: number = 47 * 60 * 60 * 1000;
/** Сколько номеров сообщений помним на один чат. */
export const MAX_TRACKED_MESSAGES: number = 500;
/** Сколько сообщений Telegram разрешает удалить одним запросом. */
export const DELETE_BATCH_SIZE: number = 100;

export const BOT_COMMANDS: { command: string; description: string }[] = [
  { command: 'start', description: 'Начать заново' },
  { command: 'forget', description: 'Стереть мои ответы' },
];
