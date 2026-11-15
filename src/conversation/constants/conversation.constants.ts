export const COMMAND_START: string = '/start';
export const COMMAND_FORGET: string = '/forget';
export const FORGET_BUTTON_LABEL: string = 'Забудь всё';
export const START_BUTTON_LABEL: string = 'Начать заново';
export const FORGET_CONFIRM_YES: string = 'Да, стереть';
export const FORGET_CONFIRM_NO: string = 'Нет, продолжим';

export const MAX_MESSAGE_LENGTH: number = 1000;
export const MAX_PERIODS: number = 20;

export const TEXT_FORGOTTEN: string =
  'Готово, я стёр твои ответы. Чтобы начать заново, напиши /start.';
export const TEXT_FORGET_CONFIRM: string =
  'Точно стереть твои ответы? Разговор начнётся заново.';
export const TEXT_FORGET_CANCELLED: string = 'Хорошо, ничего не стираю. Продолжаем.';
export const TEXT_NOTHING_TO_FORGET: string =
  'Стирать нечего: сейчас у меня нет твоих ответов. Чтобы начать, напиши /start.';
export const TEXT_TOO_LONG: string =
  'Сообщение слишком длинное. Напиши, пожалуйста, короче.';
export const TEXT_CHOOSE_OPTION: string =
  'Не понял ответ. Выбери, пожалуйста, один из вариантов.';
export const TEXT_BAD_DATE: string =
  'Не смог разобрать дату. Напиши, например: 07.11.2026 или 7 ноября.';
export const TEXT_FUTURE_DATE: string =
  'Эта дата ещё не наступила. Напиши день, с которого ты уже без работы.';
export const TEXT_DATE_SAVED: string = 'Записал дату: {date}.';
export const TEXT_PERIODS_SAVED: string = 'Записал:';
export const TEXT_NO_JOBS_WORDS: string[] = ['нет', 'не работал', 'не работала'];
