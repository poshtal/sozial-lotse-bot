import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { SearchResult, StoredChunk } from '../knowledge/types/knowledge-chunk';
import { LlmClient } from '../llm/llm.client';
import {
  DEFAULT_MIN_RELEVANCE_SCORE,
  MAX_QUESTION_LENGTH,
  SYSTEM_INSTRUCTION,
  TEXT_DECISION_NOTE,
  TEXT_FAILED,
  TEXT_SOURCES_LABEL,
  TEXT_UNKNOWN,
} from './constants/answer.constants';
import { QueryRewriter, RewrittenQuery } from './query-rewriter';
import { Answer, AnswerSource, AnswerTrace } from './types/answer';

/**
 * Отвечает на вопрос человека по тексту закона (RAG):
 * 1. модель переписывает вопрос языком закона и отсеивает вопросы не по теме;
 * 2. по этому запросу находит подходящие куски в базе знаний;
 * 3. если подходящих нет, сразу отвечает «не умею»;
 * 4. иначе отдаёт куски и исходный вопрос модели и просит пересказать по-русски;
 * 5. к ответу прикладывает источники, проверенные кодом.
 *
 * Текст вопроса и ответа нигде не логируется.
 */
@Injectable()
export class AnswerService {
  private readonly minScore: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly knowledge: KnowledgeService,
    private readonly llm: LlmClient,
    private readonly rewriter: QueryRewriter,
  ) {
    this.minScore = Number(
      this.configService.get<string>('MIN_RELEVANCE_SCORE') ??
        DEFAULT_MIN_RELEVANCE_SCORE,
    );
  }

  /**
   * @param question вопрос человека или заранее заготовленный вопрос темы
   * @param pinnedChunkIds куски, которые точно относятся к теме. Если они
   *   заданы и есть в базе, поиск по смыслу не нужен.
   */
  async answer(question: string, pinnedChunkIds: string[] = []): Promise<Answer> {
    const cleanQuestion: string = question.trim().slice(0, MAX_QUESTION_LENGTH);

    let chunks: StoredChunk[];
    const trace: AnswerTrace = new AnswerTrace();

    try {
      chunks = await this.findChunks(cleanQuestion, pinnedChunkIds, trace);
    } catch (error) {
      this.logFailure('поиск в базе знаний', error);
      return this.plain('failed', TEXT_FAILED);
    }

    // Подходящего текста в базе нет: отвечает код, а не модель.
    if (chunks.length === 0) {
      return this.plain('unknown', TEXT_UNKNOWN, trace);
    }

    let raw: string;

    try {
      raw = await this.llm.generateJson(
        SYSTEM_INSTRUCTION,
        this.buildUserContent(cleanQuestion, chunks),
      );
    } catch (error) {
      this.logFailure('запрос к модели', error);
      return this.plain('failed', TEXT_FAILED, trace);
    }

    const parsed: ModelReply | null = parseModelReply(raw);

    if (!parsed) {
      this.logFailure('разбор ответа модели', new Error('answer is not valid JSON'));
      return this.plain('failed', TEXT_FAILED, trace);
    }

    if (!parsed.answered || parsed.answer.trim() === '') {
      return this.plain('unknown', TEXT_UNKNOWN, trace);
    }

    // Источники берём только из тех кусков, что реально были в контексте.
    // Если модель не назвала ни одного настоящего, показываем все переданные.
    const cited: StoredChunk[] = chunks.filter((chunk: StoredChunk): boolean =>
      parsed.sources.includes(chunk.chunk_id),
    );
    const sources: AnswerSource[] = (cited.length > 0 ? cited : chunks).map(
      (chunk: StoredChunk): AnswerSource => ({
        source_id: chunk.source_id,
        chunk_id: chunk.chunk_id,
        title: chunk.title,
        location: chunk.location,
      }),
    );

    const answer: Answer = new Answer();
    answer.status = 'answered';
    answer.sources = sources;
    answer.trace = trace;
    answer.text = [
      parsed.answer.trim(),
      `${TEXT_SOURCES_LABEL} ${formatSources(sources)}`,
      TEXT_DECISION_NOTE,
    ].join('\n\n');
    return answer;
  }

  /** Находит куски для ответа и по пути записывает в trace, как их искали. */
  private async findChunks(
    question: string,
    pinnedChunkIds: string[],
    trace: AnswerTrace,
  ): Promise<StoredChunk[]> {
    if (pinnedChunkIds.length > 0) {
      const pinned: StoredChunk[] = await this.knowledge.getChunks(pinnedChunkIds);

      if (pinned.length > 0) {
        trace.pinned = true;
        return pinned;
      }
    }

    // Вопрос человека: сначала переписываем его языком закона.
    const rewritten: RewrittenQuery = await this.rewriter.rewrite(question);
    trace.inScope = rewritten.inScope;
    trace.rewritten = rewritten.rewritten;
    trace.query = rewritten.query;

    if (!rewritten.inScope) {
      return [];
    }

    const results: SearchResult[] = await this.knowledge.search(rewritten.query);
    trace.results = results.map((result: SearchResult) => ({
      chunk_id: result.chunk.chunk_id,
      title: result.chunk.title,
      score: result.score,
      passed: result.score >= this.minScore,
    }));

    return results
      .filter((result: SearchResult): boolean => result.score >= this.minScore)
      .map((result: SearchResult): StoredChunk => result.chunk);
  }

  /** Контекст и вопрос разделены метками, чтобы модель не путала данные и правила. */
  private buildUserContent(question: string, chunks: StoredChunk[]): string {
    const context: string = chunks
      .map(
        (chunk: StoredChunk): string =>
          `[chunk_id: ${chunk.chunk_id}]\n${chunk.title}\n${chunk.section}\n${chunk.text}`,
      )
      .join('\n\n---\n\n');

    return `CONTEXT:\n${context}\n\nQUESTION:\n${question}`;
  }

  /**
   * Пишет в лог причину сбоя, чтобы владелец мог её найти.
   * В сообщениях наших клиентов только код ответа и адрес: ни вопроса
   * человека, ни ключа там нет.
   */
  private logFailure(step: string, error: unknown): void {
    const reason: string = error instanceof Error ? error.message : 'unknown';
    console.error(`Answer failed (${step}): ${reason}`);
  }

  private plain(status: Answer['status'], text: string, trace?: AnswerTrace): Answer {
    const answer: Answer = new Answer();
    answer.status = status;
    answer.text = text;
    answer.trace = trace;
    return answer;
  }
}

interface ModelReply {
  answered: boolean;
  answer: string;
  sources: string[];
}

/** Разбирает JSON от модели. Любое отклонение от формата считается сбоем. */
function parseModelReply(raw: string): ModelReply | null {
  try {
    // Модель иногда оборачивает JSON в ```json ... ```.
    const json: string = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
    const data = JSON.parse(json) as Record<string, unknown>;

    if (typeof data.answered !== 'boolean') {
      return null;
    }

    return {
      answered: data.answered,
      answer: typeof data.answer === 'string' ? data.answer : '',
      sources: Array.isArray(data.sources)
        ? data.sources.filter((s: unknown): s is string => typeof s === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

/** "SGB 3 § 147 Grundsatz; SGB 3 § 148 ..." без повторов для частей одного §. */
function formatSources(sources: AnswerSource[]): string {
  return [...new Set(sources.map((source: AnswerSource): string => source.title))].join('; ');
}
