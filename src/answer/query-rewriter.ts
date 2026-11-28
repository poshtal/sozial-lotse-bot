import { Injectable } from '@nestjs/common';
import { LlmClient } from '../llm/llm.client';
import { REWRITE_INSTRUCTION } from './constants/answer.constants';

/** Куда относится вопрос не по теме. */
export type OutOfScopeArea = 'labor_law' | 'other';

export class RewrittenQuery {
  /** Вопрос относится к теме базы знаний (безработица, SGB III). */
  inScope: boolean;
  /** Чем вопрос не по теме: трудовое право получает свой отказ. */
  area?: OutOfScopeArea;
  /** Поисковый запрос на немецком, языком закона. */
  query: string;
  /** false, если модель недоступна и для поиска взят исходный вопрос. */
  rewritten: boolean;
}

/**
 * Переписывает вопрос человека языком закона перед поиском.
 *
 * Зачем: человек спрашивает «дадут ли денег, если сам ушёл», а в законе
 * написано «Sperrzeit bei Arbeitsaufgabe». Слова не совпадают, и поиск по
 * смыслу находит не тот параграф. Немецкий запрос из юридических терминов
 * попадает в нужный текст гораздо точнее.
 *
 * Заодно модель отмечает вопросы не по теме (погода, визы), и бот отвечает
 * «не умею», не обращаясь к базе знаний.
 */
@Injectable()
export class QueryRewriter {
  constructor(private readonly llm: LlmClient) {}

  async rewrite(question: string): Promise<RewrittenQuery> {
    try {
      const raw: string = await this.llm.generateJson(
        REWRITE_INSTRUCTION,
        `QUESTION:\n${question}`,
        // Переписать вопрос терминами проще, чем ответить: хватает лёгкой модели.
        'light',
      );
      const parsed: RewrittenQuery | null = parseRewrite(raw);

      if (parsed) {
        return parsed;
      }

      console.error('Query rewrite failed: answer is not valid JSON');
    } catch (error) {
      const reason: string = error instanceof Error ? error.message : 'unknown';
      console.error(`Query rewrite failed: ${reason}`);
    }

    // Переписать не вышло: ищем по исходному вопросу, как раньше.
    return { inScope: true, query: question, rewritten: false };
  }
}

function parseRewrite(raw: string): RewrittenQuery | null {
  try {
    const json: string = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
    const data = JSON.parse(json) as Record<string, unknown>;

    if (typeof data.inScope !== 'boolean') {
      return null;
    }

    const query: string = typeof data.query === 'string' ? data.query.trim() : '';

    // По теме, но без запроса: искать нечем, это сбой формата.
    if (data.inScope && query === '') {
      return null;
    }

    if (!data.inScope) {
      const area: OutOfScopeArea = data.area === 'labor_law' ? 'labor_law' : 'other';
      return { inScope: false, area, query: '', rewritten: true };
    }

    return { inScope: true, query, rewritten: true };
  } catch {
    return null;
  }
}
