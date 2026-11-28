import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Обращение к языковой модели Gemini.
 *
 * Используется метод generateContent: Google называет его прежним (legacy),
 * но полностью поддерживает. Новый Interactions API можно подключить здесь
 * же, остальной код о способе вызова модели не знает.
 * Документация: https://ai.google.dev/gemini-api/docs/migrate-to-interactions
 */
@Injectable()
export class LlmClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly retryWaitMs: number;
  private readonly maxAttempts: number = 3;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('GEMINI_API_URL') ??
      'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
    this.model = (
      this.configService.get<string>('GEMINI_GENERATION_MODEL') ?? ''
    ).replace(/^models\//, '');
    this.retryWaitMs = Number(
      this.configService.get<string>('LLM_RETRY_WAIT_MS') ?? 4000,
    );
    // Дольше человек в Telegram ждать не должен: лучше честно сказать «не получилось».
    this.timeoutMs = Number(
      this.configService.get<string>('LLM_TIMEOUT_MS') ?? 30000,
    );
  }

  /**
   * Просит модель ответить в формате JSON и возвращает текст ответа.
   *
   * @param systemInstruction правила для модели: кто она и что ей можно
   * @param userContent данные запроса: контекст и вопрос человека
   */
  async generateJson(
    systemInstruction: string,
    userContent: string,
  ): Promise<string> {
    if (this.apiKey === '' || this.model === '') {
      throw new Error(
        'GEMINI_API_KEY and GEMINI_GENERATION_MODEL should be set in .env',
      );
    }

    const body: string = JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: {
        // Нулевая температура: нужен точный и одинаковый от раза к разу
        // пересказ закона, а не творчество.
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    for (let attempt: number = 1; ; attempt++) {
      let response: Response;

      try {
        response = await fetch(`${this.apiUrl}/models/${this.model}:generateContent`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        // Google завис: не повторяем, чтобы человек не ждал втрое дольше.
        // Имя, а не instanceof: ошибка приходит как DOMException.
        if ((error as { name?: string } | null)?.name === 'TimeoutError') {
          throw new Error(
            `Gemini generation request timed out after ${this.timeoutMs} ms`,
          );
        }
        throw error;
      }

      if (response.ok) {
        return this.readText(await response.json());
      }

      const isTemporary: boolean =
        response.status === 429 || response.status === 503;

      if (!isTemporary || attempt >= this.maxAttempts) {
        throw new Error(
          `Gemini generation request failed: ${response.status}${await describeLimit(response)}`,
        );
      }

      await new Promise((resolve): void => {
        setTimeout(resolve, this.retryWaitMs);
      });
    }
  }

  /** Собирает текст ответа. Части с «размышлениями» модели пропускаются. */
  private readText(data: unknown): string {
    const parts: { text?: string; thought?: boolean }[] =
      (
        data as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        }
      ).candidates?.[0]?.content?.parts ?? [];

    const text: string = parts
      .filter((part): boolean => !part.thought && typeof part.text === 'string')
      .map((part): string => part.text as string)
      .join('');

    if (text.trim() === '') {
      throw new Error('Gemini returned an empty answer');
    }

    return text;
  }
}

/**
 * Для ошибки 429 достаёт из ответа Google, какой именно лимит кончился
 * (в минуту или в день) и через сколько можно повторить. Там только
 * названия лимитов, ни вопроса, ни ключа нет, поэтому это можно писать в лог.
 */
async function describeLimit(response: Response): Promise<string> {
  if (response.status !== 429) {
    return '';
  }

  try {
    const data = (await response.json()) as {
      error?: { details?: { violations?: { quotaId?: string }[]; retryDelay?: string }[] };
    };
    const details = data.error?.details ?? [];
    const quotas: string[] = details
      .flatMap((d) => d.violations ?? [])
      .map((v) => v.quotaId ?? '')
      .filter((id: string): boolean => id !== '');
    const retry: string | undefined = details.find((d) => d.retryDelay)?.retryDelay;

    const parts: string[] = [];
    if (quotas.length > 0) parts.push(`limit: ${[...new Set(quotas)].join(', ')}`);
    if (retry) parts.push(`retry in ${retry}`);
    return parts.length > 0 ? ` (${parts.join('; ')})` : '';
  } catch {
    return '';
  }
}
