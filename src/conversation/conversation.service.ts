import { Injectable } from '@nestjs/common';
import { AnswerService } from '../answer/answer.service';
import { Answer } from '../answer/types/answer';
import { ClockService } from '../clock/clock.service';
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import {
  formatTopicList,
  TopicContext,
  visibleTopics,
} from '../questionnaire/topic-filter';
import {
  AnspruchsdauerFindingNode,
  AnwartschaftFindingNode,
  AskNode,
  AskTopic,
  ChoiceNode,
  ChoiceOption,
  FindingNode,
  QuestionNode,
} from '../questionnaire/types/question-node';
import { addDays, formatGermanDate, toUtcDay } from '../rules/date.utils';
import { RulesService } from '../rules/rules.service';
import { AnspruchsdauerResult } from '../rules/types/anspruchsdauer-result';
import { AnwartschaftResult } from '../rules/types/anwartschaft-result';
import { EmploymentPeriod } from '../rules/types/employment-period';
import { PendingAnswer, Session } from '../session/session';
import { SessionService } from '../session/session.service';
import {
  ANSWER_CONFIRM_NO,
  ANSWER_CONFIRM_YES,
  COMMAND_FORGET,
  COMMAND_START,
  FORGET_BUTTON_LABEL,
  FORGET_CONFIRM_NO,
  FORGET_CONFIRM_YES,
  MAX_MESSAGE_LENGTH,
  START_BUTTON_LABEL,
  TEXT_ANSWER_REJECTED,
  TEXT_ASSUMED_UNTIL_TODAY,
  TEXT_ASSUMED_UNTIL_UNEMPLOYED,
  TEXT_BAD_DATE,
  TEXT_CHOOSE_OPTION,
  TEXT_DATE_SAVED,
  TEXT_FORGET_CANCELLED,
  TEXT_FORGET_CONFIRM,
  TEXT_FORGOTTEN,
  TEXT_FUTURE_DATE,
  TEXT_NOTHING_TO_FORGET,
  TEXT_PERIODS_ASSUMED,
  TEXT_PERIODS_SAVED,
  TEXT_TOO_LONG,
} from './constants/conversation.constants';
import { parseHumanDate } from './human-date.parser';
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
    private readonly answers: AnswerService,
  ) {}

  async handleMessage(chatId: string, text: string): Promise<BotReply> {
    const input: string = text.trim();
    const reply: BotReply = new BotReply();

    // Команда /start или кнопка «Начать заново»: всегда с начала.
    if (this.isStartCommand(input)) {
      this.startOver(chatId, reply);
      return reply;
    }

    const session: Session | undefined = this.sessions.get(chatId);

    if (this.isForgetCommand(input)) {
      if (!session) {
        // Ответов уже нет, но переписка на экране могла остаться.
        reply.messages.push(TEXT_NOTHING_TO_FORGET);
        reply.finished = true;
        reply.eraseChat = true;
        return reply;
      }

      // Не стираем сразу: кнопка всегда на виду, её легко нажать случайно.
      session.confirmingForget = true;
      this.sessions.touch(session);
      reply.messages.push(TEXT_FORGET_CONFIRM);
      reply.options = [FORGET_CONFIRM_YES, FORGET_CONFIRM_NO];
      return reply;
    }

    // Новый разговор или прошёл час тишины: начинаем с начала.
    if (!session) {
      this.startOver(chatId, reply);
      return reply;
    }

    if (session.confirmingForget) {
      session.confirmingForget = false;

      if (input.toLowerCase() === FORGET_CONFIRM_YES.toLowerCase()) {
        this.sessions.forget(chatId);
        reply.messages.push(TEXT_FORGOTTEN);
        reply.finished = true;
        reply.eraseChat = true;
        return reply;
      }

      this.sessions.touch(session);
      reply.messages.push(TEXT_FORGET_CANCELLED);
      this.showQuestion(this.questionnaire.getNode(session.nodeId), reply, session);
      return reply;
    }

    this.sessions.touch(session);

    if (input.length > MAX_MESSAGE_LENGTH) {
      reply.messages.push(TEXT_TOO_LONG);
      this.showOptions(this.questionnaire.getNode(session.nodeId), reply, session);
      return reply;
    }

    const node: QuestionNode = this.questionnaire.getNode(session.nodeId);

    // Свободные вопросы: тема кнопкой или свой вопрос, ответ по базе знаний.
    if (node.type === 'ask') {
      await this.handleAsk(node, input, chatId, session, reply);
      return reply;
    }

    // Бот понял ответ с предположением и ждёт «Да, верно» или «Нет».
    if (session.pendingAnswer) {
      const pending: PendingAnswer = session.pendingAnswer;
      session.pendingAnswer = undefined;

      if (input.toLowerCase() === ANSWER_CONFIRM_YES.toLowerCase()) {
        session.answers[pending.saveAs] = pending.value;
        session.nodeId = pending.next;
        this.showFrom(chatId, session, reply);
        return reply;
      }

      if (input.toLowerCase() === ANSWER_CONFIRM_NO.toLowerCase()) {
        reply.messages.push(TEXT_ANSWER_REJECTED);
        return reply;
      }

      // Человек не нажал кнопку, а сразу написал по-другому:
      // разбираем это как новый ответ на тот же вопрос.
    }

    const nextId: string | undefined = this.acceptAnswer(
      node,
      input,
      session,
      reply,
    );

    if (session.pendingAnswer) {
      // Вопрос «Верно?» с кнопками уже лежит в reply.
      return reply;
    }

    if (!nextId) {
      // Ответ не подошёл: в reply уже лежит объяснение. Сам вопрос не
      // повторяем, он остался выше в чате. Возвращаем только кнопки.
      this.showOptions(node, reply, session);
      return reply;
    }

    session.nodeId = nextId;
    this.showFrom(chatId, session, reply);
    return reply;
  }

  private async handleAsk(
    node: AskNode,
    input: string,
    chatId: string,
    session: Session,
    reply: BotReply,
  ): Promise<void> {
    if (input.toLowerCase() === node.exitLabel.toLowerCase()) {
      session.nodeId = node.next;
      this.showFrom(chatId, session, reply);
      return;
    }

    // Кнопка темы: вопрос и нужные параграфы заданы заранее в дереве.
    // Любой другой текст: вопрос человека, параграфы ищет база знаний.
    const topics: AskTopic[] = visibleTopics(node.topics, this.topicContext(session));
    const topic: AskTopic | undefined = topics.find(
      (t: AskTopic, index: number): boolean =>
        t.label.toLowerCase() === input.toLowerCase() ||
        input === String(index + 1),
    );

    const answer: Answer = topic
      ? await this.answers.answer(topic.question, topic.chunks)
      : await this.answers.answer(input);

    reply.messages.push(answer.text);
    reply.messages.push(node.againText);
    reply.answersQuestion = true;
    this.showOptions(node, reply, session);
  }

  private startOver(chatId: string, reply: BotReply): void {
    const session: Session = this.sessions.start(
      chatId,
      this.questionnaire.getStartId(),
    );
    this.showFrom(chatId, session, reply);
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
        const date: Date | null = parseHumanDate(input, this.today());

        if (!date) {
          reply.messages.push(TEXT_BAD_DATE);
          return undefined;
        }

        if (date.getTime() > this.today().getTime()) {
          reply.messages.push(TEXT_FUTURE_DATE);
          return undefined;
        }

        session.answers[node.saveAs] = date;
        // Дата понята не дословно, поэтому показываем, как именно.
        reply.messages.push(
          TEXT_DATE_SAVED.replace('{date}', formatGermanDate(date)),
        );
        return node.next;
      }

      case 'periods': {
        // Если человек написал только начало, концом считаем последний день
        // перед увольнением. Если он работает, то сегодняшний день.
        const unemployedSince: Date | undefined = session.answers[
          'unemployedSince'
        ] as Date | undefined;
        const assumedEnd: Date = unemployedSince
          ? addDays(unemployedSince, -1)
          : this.today();
        const parsed: PeriodsParseResult = parsePeriods(
          input,
          this.today(),
          assumedEnd,
        );

        if (parsed.error) {
          reply.messages.push(parsed.error);
          return undefined;
        }

        // Бот сам подставил конец: сначала показываем и переспрашиваем.
        if (parsed.assumedEnd) {
          session.pendingAnswer = {
            saveAs: node.saveAs,
            next: node.next,
            value: parsed.periods,
          };
          reply.messages.push(
            [TEXT_PERIODS_ASSUMED, ...this.formatPeriods(parsed.periods)].join('\n'),
          );
          reply.messages.push(
            (unemployedSince
              ? TEXT_ASSUMED_UNTIL_UNEMPLOYED
              : TEXT_ASSUMED_UNTIL_TODAY
            ).replace('{date}', formatGermanDate(assumedEnd)),
          );
          reply.options = [ANSWER_CONFIRM_YES, ANSWER_CONFIRM_NO];
          return undefined;
        }

        session.answers[node.saveAs] = parsed.periods;

        if (parsed.periods.length > 0) {
          reply.messages.push(
            [TEXT_PERIODS_SAVED, ...this.formatPeriods(parsed.periods)].join('\n'),
          );
        }

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

        case 'finding': {
          const finding: Finding = this.buildFinding(node, session);
          reply.messages.push(finding.text);
          session.nodeId = finding.next;
          break;
        }

        case 'end':
          reply.messages.push(node.text);
          this.sessions.forget(chatId);
          reply.finished = true;
          return;

        default:
          this.showQuestion(node, reply, session);
          return;
      }
    }

    throw new Error('Questionnaire has a loop without questions');
  }

  private showQuestion(node: QuestionNode, reply: BotReply, session: Session): void {
    if (node.type === 'end') {
      return;
    }

    if (node.type === 'ask') {
      reply.messages.push(this.askText(node, session));
    } else if (node.type !== 'finding') {
      reply.messages.push(node.text);
    }

    this.showOptions(node, reply, session);
  }

  private showOptions(node: QuestionNode, reply: BotReply, session: Session): void {
    if (node.type === 'choice') {
      reply.options = node.options.map((o: ChoiceOption): string => o.label);
    }

    if (node.type === 'ask') {
      reply.options = [
        ...visibleTopics(node.topics, this.topicContext(session)).map(
          (t: AskTopic): string => t.label,
        ),
        node.exitLabel,
      ];
    }
  }

  /** Список того, что человеку может быть доступно, или общий текст, если ничего не подошло. */
  private askText(node: AskNode, session: Session): string {
    const topics: AskTopic[] = visibleTopics(node.topics, this.topicContext(session));

    if (topics.length === 0 || !node.listText) {
      return node.text;
    }

    return node.listText.replace('{list}', formatTopicList(topics));
  }

  private topicContext(session: Session): TopicContext {
    const status: string | undefined = session.answers['status'] as string | undefined;

    return {
      status,
      // Уже получает пособие или анкета показала, что стаж набран.
      algEligible: status === 'alg1' || session.answers['algEligible'] === true,
    };
  }

  private formatPeriods(periods: EmploymentPeriod[]): string[] {
    return periods.map(
      (p: EmploymentPeriod): string =>
        `${formatGermanDate(p.start)} - ${formatGermanDate(p.end)}`,
    );
  }

  private buildFinding(node: FindingNode, session: Session): Finding {
    const periods: EmploymentPeriod[] =
      (session.answers[node.periodsFrom] as EmploymentPeriod[] | undefined) ?? [];

    // Нет даты увольнения: человек работает, считаем «если бы уволили завтра».
    const referenceDate: Date =
      (session.answers[node.referenceFrom] as Date | undefined) ??
      addDays(this.today(), 1);

    return node.rule === 'anspruchsdauer'
      ? this.buildDurationFinding(node, session, periods, referenceDate)
      : this.buildAnwartschaftFinding(node, session, periods, referenceDate);
  }

  private buildAnwartschaftFinding(
    node: AnwartschaftFindingNode,
    session: Session,
    periods: EmploymentPeriod[],
    referenceDate: Date,
  ): Finding {
    const result: AnwartschaftResult = this.rules.checkAnwartschaft(
      periods,
      referenceDate,
    );

    // По этому решается, какие подсказки показывать дальше.
    session.answers['algEligible'] = result.fulfilled;

    const template: string = result.fulfilled ? node.fulfilled : node.missing;

    return {
      text: template
        .replace('{countedDays}', String(result.countedDays))
        .replace('{countedMonths}', String(result.countedMonths))
        .replace('{missingDays}', String(result.missingDays))
        .replace('{missingMonths}', String(result.missingMonths)),
      next: result.fulfilled && node.fulfilledNext ? node.fulfilledNext : node.next,
    };
  }

  private buildDurationFinding(
    node: AnspruchsdauerFindingNode,
    session: Session,
    periods: EmploymentPeriod[],
    referenceDate: Date,
  ): Finding {
    const result: AnspruchsdauerResult = this.rules.calculateAnspruchsdauer(
      periods,
      referenceDate,
      String(session.answers[node.ageFrom]),
    );

    // Срок уже максимальный для возраста: более ранняя работа ничего не добавит.
    const template: string =
      result.benefitMonths === result.maxForAge ? node.exact : node.belowMax;

    return {
      text: template
        .replace('{months}', String(result.benefitMonths))
        .replace('{countedMonths}', String(result.countedMonths))
        .replace('{maxMonths}', String(result.maxForAge))
        .replace('{monthsForMax}', String(result.monthsForMax)),
      next: node.next,
    };
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

  private isStartCommand(input: string): boolean {
    return (
      input === COMMAND_START ||
      input.toLowerCase() === START_BUTTON_LABEL.toLowerCase()
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

/** Текст находки и куда разговор идёт дальше. */
interface Finding {
  text: string;
  next: string;
}
