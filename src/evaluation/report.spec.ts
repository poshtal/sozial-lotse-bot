import { Answer, AnswerTrace } from '../answer/types/answer';
import { judge } from './evaluation';
import { buildReport } from './report';

describe('buildReport', () => {
  it('печатает сводку, таблицу и подробности с отметкой нужного параграфа', () => {
    const trace: AnswerTrace = new AnswerTrace();
    trace.rewritten = true;
    trace.query = 'Sperrzeit Arbeitsaufgabe';
    trace.results = [
      { chunk_id: 'sgb-3-p159-1', title: 'SGB 3 § 159 Ruhen bei Sperrzeit', score: 0.771, passed: true },
    ];

    const reply: Answer = new Answer();
    reply.status = 'answered';
    reply.text = 'Наступает Sperrzeit.\n\nИсточник: § 159';
    reply.trace = trace;
    reply.sources = [{ source_id: 'sgb-3', chunk_id: 'sgb-3-p159-1', title: '', location: '' }];

    const report: string = buildReport(
      [
        judge(
          { id: '2', question: 'дадут ли денег, если сам ушёл?', expected: 'answer', paragraphs: ['159'], note: '' },
          reply,
        ),
      ],
      0.57,
      '2026-11-25',
    );

    expect(report).toContain('Совпало с ожиданием: **1**');
    expect(report).toContain('| 2 | дадут ли денег, если сам ушёл? | ответить | ответил | 1-е место | да |');
    expect(report).toContain('Запрос для поиска: Sperrzeit Arbeitsaufgabe');
    expect(report).toContain('0.771 проходит: SGB 3 § 159 Ruhen bei Sperrzeit ← нужный');
    expect(report).toContain('> Наступает Sperrzeit.');
  });
});
