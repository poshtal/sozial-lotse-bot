import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import {
  ChoiceNode,
  ChoiceOption,
  FindingNode,
  QuestionNode,
} from '../questionnaire/types/question-node';
import { addDays, parseGermanDate, toUtcDay } from '../rules/date.utils';
import { RulesService } from '../rules/rules.service';
import { AnwartschaftResult } from '../rules/types/anwartschaft-result';
import { EmploymentPeriod } from '../rules/types/employment-period';
import { Session } from '../session/session';
import { SessionService } from '../session/session.service';
import {
  COMMAND_FORGET,
  COMMAND_START,
  FORGET_BUTTON_LABEL,
  MAX_MESSAGE_LENGTH,
  TEXT_BAD_DATE,
  TEXT_CHOOSE_OPTION,
  TEXT_FORGOTTEN,
  TEXT_FUTURE_DATE,
  TEXT_TOO_LONG,
} from './constants/conversation.constants';
import { parsePeriods, PeriodsParseResult } from './periods.parser';
import { BotReply } from './types/bot-reply';

/**
 * Ядро разговора. Не знает, откуда пришло сообщение (консоль или Telegram):
 * получает текст и номер чата, возвращает сообщения и кнопки.
 *
 * Текст сообщений здесь нигде не логируется.
 */
@Injectable()
export class ConversationService {
  constructor(
    private readonly questionnaire: QuestionnaireService,
    private readonly rules: RulesService,
    private readonly sessions: SessionService,
    private readonly clock: ClockService,
  ) {}

  handleMessage(chatId: string, text: string): BotReply {
    const input: string = text.trim();
    const reply: BotReply = new BotReply();

    if (this.isForgetCommand(input)) {
      this.sessions.forget(chatId);
      reply.messages.push(TEXT_FORGOTTEN);
      return reply;
    }

    const session: Session | undefined = this.sessions.get(chatId);

    // Новый разговор, команда /start или прошёл час тишины: начинаем с начала.
    if (!session || input === COMMAND_START) {
      const newSession: Session = this.sessions.start(
        chatId,
        this.questionnaire.getStartId(),
      );
      this.showFrom(chatId, newSession, reply);
      return reply;
    }

    this.sessions.touch(session);

    if (input.length > MAX_MESSAGE_LENGTH) {
      reply.messages.push(TEXT_TOO_LONG);
      this.showQuestion(this.questionnaire.getNode(session.nodeId), reply);
      return reply;
    }

    const node: QuestionNode = this.questionnaire.getNode(session.nodeId);
    const nextId: string | undefined = this.acceptAnswer(
      node,
      input,
      session,
      reply,
    );

    if (!nextId) {
      // Ответ не подошёл: в reply уже лежит объяснение, повторяем вопрос.
      this.showQuestion(node, reply);
      return reply;
    }

    session.nodeId = nextId;
    this.showFrom(chatId, session, reply);
    return reply;
  }

  /**
   * Проверяет ответ на вопрос текущего узла и сохраняет его.
   * Возвращает id следующего узла или undefined, если ответ не подошёл.
   */
  private acceptAnswer(
    node: QuestionNode,
    input: string,
    session: Session,
    reply: BotReply,
  ): string | undefined {
    switch (node.type) {
      case 'choice': {
        const option: ChoiceOption | undefined = this.findOption(node, input);

        if (!option) {
          reply.messages.push(TEXT_CHOOSE_OPTION);
          return undefined;
        }

        if (node.saveAs) {
          session.answers[node.saveAs] = option.id;
        }

        return option.next;
      }

      case 'date': {
        const date: Date | null = parseGermanDate(input);

        if (!date) {
          reply.messages.push(TEXT_BAD_DATE);
          return undefined;
        }

        if (date.getTime() > this.today().getTime()) {
          reply.messages.push(TEXT_FUTURE_DATE);
          return undefined;
        }

        session.answers[node.saveAs] = date;
        return node.next;
      }

      case 'periods': {
        const parsed: PeriodsParseResult = parsePeriods(input, this.today());

        if (parsed.error) {
          reply.messages.push(parsed.error);
          return undefined;
        }

        session.answers[node.saveAs] = parsed.periods;
        return node.next;
      }

      default:
        // Узлы без вопроса сюда не попадают: showFrom проходит их сам.
        return undefined;
    }
  }

  /**
   * Показывает узлы начиная с текущего, пока не дойдёт до вопроса
   * (ждём ответа) или до конца разговора (стираем ответы).
   */
  private showFrom(chatId: string, session: Session, reply: BotReply): void {
    // Защита от зацикленного дерева.
    for (let step: number = 0; step < 50; step++) {
      const node: QuestionNode = this.questionnaire.getNode(session.nodeId);

      switch (node.type) {
        case 'message':
          reply.messages.push(node.text);
          session.nodeId = node.next;
          break;

        case 'finding':
          reply.messages.push(this.buildFinding(node, session));
          session.nodeId = node.next;
          break;

        case 'end':
          reply.messages.push(node.text);
          this.sessions.forget(chatId);
          return;

        default:
          this.showQuestion(node, reply);
          return;
      }
    }

    throw new Error('Questionnaire has a loop without questions');
  }

  private showQuestion(node: QuestionNode, reply: BotReply): void {
    if (node.type === 'end') {
      return;
    }

    if (node.type !== 'finding') {
      reply.messages.push(node.text);
    }

    if (node.type === 'choice') {
      reply.options = node.options.map((o: ChoiceOption): string => o.label);
    }
  }

  private buildFinding(node: FindingNode, session: Session): string {
    const periods: EmploymentPeriod[] =
      (session.answers[node.periodsFrom] as EmploymentPeriod[] | undefined) ?? [];

    // Нет даты увольнения: человек работает, считаем «если бы уволили завтра».
    const referenceDate: Date =
      (session.answers[node.referenceFrom] as Date | undefined) ??
      addDays(this.today(), 1);

    const result: AnwartschaftResult = this.rules.checkAnwartschaft(
      periods,
      referenceDate,
    );

    const template: string = result.fulfilled ? node.fulfilled : node.missing;

    return template
      .replace('{countedDays}', String(result.countedDays))
      .replace('{countedMonths}', String(result.countedMonths))
      .replace('{missingDays}', String(result.missingDays))
      .replace('{missingMonths}', String(result.missingMonths));
  }

  /** Ответ на вопрос с кнопками: номер варианта или его текст. */
  private findOption(node: ChoiceNode, input: string): ChoiceOption | undefined {
    const byNumber: ChoiceOption | undefined = /^\d+$/.test(input)
      ? node.options[Number(input) - 1]
      : undefined;

    return (
      byNumber ??
      node.options.find(
        (o: ChoiceOption): boolean =>
          o.label.toLowerCase() === input.toLowerCase(),
      )
    );
  }

  private isForgetCommand(input: string): boolean {
    return (
      input === COMMAND_FORGET ||
      input.toLowerCase() === FORGET_BUTTON_LABEL.toLowerCase()
    );
  }

  private today(): Date {
    return toUtcDay(this.clock.now());
  }
}
