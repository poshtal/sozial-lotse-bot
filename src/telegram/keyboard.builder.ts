import { Keyboard } from 'grammy';
import {
  FORGET_BUTTON_LABEL,
  FORGET_CONFIRM_YES,
  START_BUTTON_LABEL,
} from '../conversation/constants/conversation.constants';
import { BotReply } from '../conversation/types/bot-reply';

/**
 * Собирает кнопки под полем ввода.
 *
 * Варианты ответа идут по одному в строке. Последней строкой всегда стоит
 * «Забудь всё», пока идёт разговор, или «Начать заново», когда он закончен.
 */
export function buildKeyboard(reply: BotReply): Keyboard {
  const keyboard: Keyboard = new Keyboard();

  for (const option of reply.options) {
    keyboard.text(option).row();
  }

  const isConfirmingForget: boolean = reply.options.includes(FORGET_CONFIRM_YES);

  if (reply.finished) {
    keyboard.text(START_BUTTON_LABEL);
  } else if (!isConfirmingForget) {
    // На вопросе «Точно стереть?» вторая кнопка «Забудь всё» только мешает.
    keyboard.text(FORGET_BUTTON_LABEL);
  }

  return keyboard.resized().persistent();
}
