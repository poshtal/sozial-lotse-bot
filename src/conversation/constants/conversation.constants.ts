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
  'Моя память уже пуста: твоих ответов у меня нет. Чтобы начать, напиши /start.';
export const TEXT_TOO_LONG: string =
  'Сообщение слишком длинное. Напиши, пожалуйста, короче.';
export const TEXT_CHOOSE_OPTION: string =
  'Не понял ответ. Выбери, пожалуйста, один из вариантов.';
export const TEXT_BAD_DATE: string =
  'Не смог разобрать дату. Напиши, например: 07.11.2026 или 7 ноября.';
export const TEXT_FUTURE_DATE: string =
  'Эта дата ещё не наступила. Напиши день, с которого ты уже без работы.';
export const TEXT_FUTURE_TOO_FAR: string =
  'Эта дата слишком далеко. Напиши первый день без работы: он может быть и впереди, но не дальше чем через {months} мес.';
export const TEXT_DATE_SAVED: string = 'Записал дату: {date}.';
export const TEXT_PERIODS_SAVED: string = 'Записал:';
export const ANSWER_CONFIRM_YES: string = 'Да, верно';
export const ANSWER_CONFIRM_NO: string = 'Нет, напишу иначе';
export const TEXT_PERIODS_ASSUMED: string = 'Я понял так:';
export const TEXT_ASSUMED_UNTIL_UNEMPLOYED: string =
  'Конец ты не написал, поэтому я поставил {date}: это последний день перед тем, как ты остался без работы. Верно?';
export const TEXT_ASSUMED_UNTIL_TODAY: string =
  'Конец ты не написал, поэтому я поставил сегодняшний день, {date}: получается, ты работаешь там до сих пор. Верно?';
export const TEXT_ANSWER_REJECTED: string =
  'Хорошо, тогда напиши начало и конец, например: 15.08.2024 - 30.09.2024.';
export const TEXT_NO_JOBS_WORDS: string[] = ['нет', 'не работал', 'не работала'];
