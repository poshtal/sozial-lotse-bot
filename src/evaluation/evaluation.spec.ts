import { Answer, AnswerTrace } from '../answer/types/answer';
import {
  collectScores,
  EvalCase,
  judge,
  paragraphOf,
  parseCases,
  suggestThreshold,
} from './evaluation';

function evalCase(expected: EvalCase['expected'], paragraphs: string[] = []): EvalCase {
  return { id: '1', question: 'вопрос', expected, paragraphs, note: '' };
}

function answer(
  status: Answer['status'],
  found: [string, number][] = [],
  sources: string[] = [],
  inScope: boolean = true,
): Answer {
  const trace: AnswerTrace = new AnswerTrace();
  trace.inScope = inScope;
  trace.rewritten = true;
  trace.query = 'Anfrage';
  trace.results = found.map(([chunk_id, score]) => ({
    chunk_id,
    title: chunk_id,
    score,
    passed: score >= 0.57,
  }));

  const result: Answer = new Answer();
  result.status = status;
  result.text = 'текст';
  result.trace = trace;
  result.sources = sources.map((chunk_id) => ({
    source_id: 'sgb-3',
    chunk_id,
    title: chunk_id,
    location: '',
  }));
  return result;
}

describe('parseCases', () => {
  it('читает строки, пропускает заголовок, пустые строки и комментарии', () => {
    const cases: EvalCase[] = parseCases(
      'id;question;expected;paragraphs;note\r\n' +
        '1;меня уволили?;answer;38, 141;заметка\n' +
        '\n' +
        '# временно выключен\n' +
        '2;погода?;out_of_scope;;\n',
    );

    expect(cases).toEqual([
      { id: '1', question: 'меня уволили?', expected: 'answer', paragraphs: ['38', '141'], note: 'заметка' },
      { id: '2', question: 'погода?', expected: 'out_of_scope', paragraphs: [], note: '' },
    ]);
  });

  it('ругается на неизвестное ожидание и называет строку', () => {
    expect(() => parseCases('шапка\n1;вопрос;maybe;;')).toThrow('Строка 2');
  });
});

describe('paragraphOf', () => {
  it.each([
    ['sgb-3-p141', '141'],
    ['sgb-3-p159-2', '159'],
    ['sgb-3-p26a', '26a'],
    ['что-то другое', null],
  ])('%s → %s', (chunkId, expected) => {
    expect(paragraphOf(chunkId)).toBe(expected);
  });
});

describe('judge', () => {
  it('answer: ответил по нужному параграфу — совпало, и знает место в поиске', () => {
    const result = judge(
      evalCase('answer', ['159']),
      answer('answered', [['sgb-3-p158', 0.7], ['sgb-3-p159-1', 0.69]], ['sgb-3-p159-1']),
    );

    expect(result.verdict).toBe('pass');
    expect(result.rank).toBe(2);
  });

  it('answer: ответил по другим параграфам — проверить глазами', () => {
    const result = judge(
      evalCase('answer', ['159']),
      answer('answered', [['sgb-3-p158', 0.7]], ['sgb-3-p158']),
    );

    expect(result.verdict).toBe('check');
    expect(result.rank).toBeNull();
  });

  it('answer: отказал — не совпало', () => {
    expect(judge(evalCase('answer', ['159']), answer('unknown')).verdict).toBe('fail');
  });

  it('answer: ошибочно отсеян — не совпало, с понятной причиной', () => {
    const result = judge(evalCase('answer', ['159']), answer('unknown', [], [], false));

    expect(result.verdict).toBe('fail');
    expect(result.reason).toContain('отсеян');
  });

  it('refuse: честный отказ — совпало, ответ — не совпало', () => {
    expect(judge(evalCase('refuse'), answer('unknown')).verdict).toBe('pass');
    expect(judge(evalCase('refuse'), answer('answered')).verdict).toBe('fail');
  });

  it('out_of_scope: совпало, только если отсеян на шаге переписывания', () => {
    expect(judge(evalCase('out_of_scope'), answer('unknown', [], [], false)).verdict).toBe('pass');
    // Отказ после поиска — это не то же самое: вопрос не распознан как посторонний.
    expect(judge(evalCase('out_of_scope'), answer('unknown')).verdict).toBe('fail');
  });

  it('partial: всегда проверить глазами', () => {
    expect(judge(evalCase('partial'), answer('answered')).verdict).toBe('check');
    expect(judge(evalCase('partial'), answer('unknown')).verdict).toBe('check');
  });

  it('сбой — всегда не совпало', () => {
    const failed: Answer = new Answer();
    failed.status = 'failed';
    failed.text = 'недоступно';

    const result = judge(evalCase('refuse'), failed);

    expect(result.verdict).toBe('fail');
    expect(result.rank).toBeNull();
  });
});

describe('порог', () => {
  it('собирает оценки нужных кусков и кусков у вопросов без ответа', () => {
    const stats = collectScores([
      judge(evalCase('answer', ['159']), answer('answered', [['sgb-3-p159-1', 0.77], ['sgb-3-p158', 0.7]])),
      judge(evalCase('refuse'), answer('unknown', [['sgb-3-p158', 0.62], ['sgb-3-p142', 0.6]])),
      judge(evalCase('out_of_scope'), answer('unknown', [], [], false)),
    ]);

    expect(stats.relevant).toEqual([0.77]);
    expect(stats.irrelevant).toEqual([0.62, 0.6]);
  });

  it('предлагает порог посередине, если оценки не пересекаются', () => {
    expect(suggestThreshold({ relevant: [0.77, 0.7], irrelevant: [0.62, 0.6] })).toBe(0.66);
  });

  it('не предлагает порог, если оценки пересекаются или данных нет', () => {
    expect(suggestThreshold({ relevant: [0.7], irrelevant: [0.71] })).toBeNull();
    expect(suggestThreshold({ relevant: [0.7], irrelevant: [] })).toBeNull();
  });
});
