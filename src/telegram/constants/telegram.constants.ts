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

export const BOT_COMMANDS: { command: string; description: string }[] = [
  { command: 'start', description: 'Начать заново' },
  { command: 'forget', description: 'Стереть мои ответы' },
];
