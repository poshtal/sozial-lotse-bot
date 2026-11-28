# SozialLotse

[Русский](README.md) | **English** | [Deutsch](README.de.md)

A Russian-language Telegram bot for people in Germany who have lost their job
or may lose it. It asks the questions itself, checks the entitlement to
unemployment benefit (Arbeitslosengeld) and its duration by the rules of the
law, shows what else the person may be entitled to, and answers questions from
the text of the German Social Code, Book III (SGB III), citing the section.

Final project of an AI Engineer course. How the project is built and why is
described in [docs/project.md](docs/project.md) (in Russian).

> This is information, not legal advice. The final decision is always made by
> the authority.

![Bot QR code](docs/qr-telegram.png)

## Features

- **Questionnaire.** Situation via buttons, dates as free text ("7 ноября",
  "с 1 июля 24 по сейчас"); a one-letter typo is corrected automatically.
  People who have received a notice of dismissal but are still working get
  their own button: the bot accepts a future date and immediately reminds them
  to register with the employment agency within 3 days (§ 38).
- **Entitlement to benefit.** 12 months of insured employment within the last
  30 (§§ 142, 143 SGB III). Calculated by code, not by the language model.
- **Benefit duration.** 6 to 24 months, depending on insured employment within
  5 years and on age (§ 147). Age is asked as a range, the exact number is not
  needed.
- **"What may be available to you".** Up to 9 hints from a catalogue, selected
  by the person's situation: money for the job search, coaching, training,
  start-up grant (Gründungszuschuss), side income, insolvency pay
  (Insolvenzgeld) and more.
- **Questions about the law (RAG).** Answers from the text of SGB III with the
  section cited, followed by 2–3 "people also ask" buttons.
- **Honest refusals.** Off-topic questions, employment law questions and
  questions the law does not answer each get their own reply. The bot does not
  make things up.
- **Stores nothing.** Memory lasts one hour; the "Forget everything" button
  erases both the memory and the chat on screen.

## Versions

| Component | Version |
| --- | --- |
| Node.js | 22 |
| TypeScript | 5.9 |
| NestJS | 11 |
| grammY (Telegram) | 1.46 |
| Qdrant | image `qdrant/qdrant:latest` |
| Answer and rewriting model | Gemini 3.5 Flash Lite |
| Embedding model | Gemini Embedding 2 |
| Law | SGB III, version of 24 July 2026 |

## Running from scratch

You need Docker Desktop, a Telegram account and a free Gemini API key.

1. **Telegram bot.** Send `/newbot` to [@BotFather](https://t.me/BotFather) and
   save the token.
2. **Gemini key.** Create one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. **Settings.** Copy `.env.example` to `.env` and fill in `TELEGRAM_BOT_TOKEN`,
   `GEMINI_API_KEY` and `GEMINI_EMBEDDING_MODEL` (the embedding model ID from
   AI Studio). Everything else is pre-filled.
4. **Build:**
   ```bash
   docker compose build bot
   ```
5. **Load the law into the knowledge base.** Once, takes a few minutes:
   ```bash
   docker compose run --rm bot node dist/ingest.js
   ```
   At the end: "Готово: источник sgb-3, версия 1, кусков 385".
6. **Start:**
   ```bash
   docker compose up -d bot
   docker compose logs --tail 5 bot
   ```
   The log shows "Бот @name запущен" (bot started).

**Check.** Send `/start` to the bot, tap "Окей" and "Недавно уволили, ничего
не получаю" (recently dismissed, receiving nothing), then ask
"дадут ли денег, если сам ушёл?" (will I get money if I quit myself?).

Expected answer: if you quit without an important reason, a blocking period
(Sperrzeit) applies, usually 12 weeks, in some cases 3 or 6; source § 159
SGB III. Below the answer there are "people also ask" buttons.

Telegram allows one running copy of the bot per token. If the log says "Этот
бот уже запущен в другом месте" (already running elsewhere), stop the other
copy (for example, `npm run start` in another window).

## `.env` settings

| Variable | Meaning | Default |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | token from @BotFather. Empty: the bot runs in the console | — |
| `INTERFACE` | `console` forces the console even if a token is set | — |
| `SESSION_TTL_MINUTES` | minutes of silence after which the bot forgets the conversation | 60 |
| `GEMINI_API_KEY` | Gemini API key | — |
| `GEMINI_EMBEDDING_MODEL` | embedding model. After changing it, reload the knowledge base | — |
| `GEMINI_GENERATION_MODEL` | model that answers from the retrieved sections of the law | `gemini-3.5-flash-lite` |
| `GEMINI_LIGHT_MODEL` | model that rewrites the question. Empty: same as for answers | `gemini-3.5-flash-lite` |
| `LLM_TIMEOUT_MS` | how long to wait for the model before "try again later" | 30000 |
| `LLM_RETRY_WAIT_MS` | pause before retrying when Google is overloaded (429, 503) | 4000 |
| `QDRANT_URL` | Qdrant address inside docker compose | `http://qdrant:6333` |
| `KNOWLEDGE_DB_COLLECTION_NAME` | Qdrant collection | `laws` |
| `TOP_K_VALUE` | how many chunks of the law the search passes to the model | 8 |
| `MIN_RELEVANCE_SCORE` | chunks below this similarity score are dropped | 0.57 |

The `.env` file is not committed.

## Commands

| What | Command |
| --- | --- |
| Bot in the console, without Telegram | `docker compose run --rm -e INTERFACE=console bot` |
| Load the law (all sections) | `docker compose run --rm bot node dist/ingest.js` |
| Load selected sections only | `docker compose run --rm bot node dist/ingest.js --paragraphs 136-164,81` |
| Check the search without a model answer | `docker compose run --rm bot node dist/search.js "question"` |
| Same, without rewriting the question | `docker compose run --rm bot node dist/search.js --raw "question"` |
| Quality evaluation | `docker compose run --rm -T bot node dist/evaluate.js > reports/evaluation.md` |
| Tests (241) | `npm test` |
| Run without Docker | `npm install`, then `npm run start:dev` (needs Node.js 22) |

Only the project owner loads the law. Loading the same text again changes
nothing. A new version of the law is loaded as a new version: the previous one
stays in the base marked `active: false`, and the search does not see it.

## Quality evaluation

The test set lives in `data/evaluation.csv`: 10 questions phrased the way a
friend would ask, each with an expectation written down in advance.

| Expectation | What the bot must do |
| --- | --- |
| `answer` | answer and cite the right sections |
| `refuse` | refuse honestly: on topic, but the law has no answer |
| `partial` | only a partial answer is possible; a human judges it |
| `out_of_scope` | filter out right away, at the rewriting step |

| Run | Matched | To check | Not matched | Report |
| --- | --- | --- | --- | --- |
| 47 chunks of the law, 3.6 Flash | 7 | 2 | 1 (Google limit) | `reports/evaluation-before.md` |
| Full SGB III, 3.6 Flash | 8 | 2 | 0 | `reports/evaluation-after.md` |
| Full SGB III, answer fixes, 3.5 Flash Lite | 8 | 2 | 0 | `reports/evaluation-lite.md` |

What the manual review found and what was done about it is described in
[docs/project.md](docs/project.md) (section 6, in Russian). The `-T` flag makes
only the report go into the file, while the progress stays on screen.

## How the bot answers a question

1. A light model rewrites the question in the German terms of the law:
   "will I get money if I quit myself" becomes "Sperrzeit Arbeitsaufgabe ...".
   An off-topic or employment law question gets its own refusal right away.
2. Qdrant returns the 8 nearest chunks of the law, current version only.
3. Chunks below the similarity threshold are dropped. If none is left, the bot
   answers "I can't do this yet" and the model is not called.
4. The model answers only from these chunks, in Russian, and returns JSON: the
   text, the chunk IDs used, and "people also ask" questions.
5. The code checks the sources: only chunks that were in the context are
   shown.

For catalogue items and "people also ask" buttons the sections are known in
advance, so no semantic search is needed there.

## Structure

```
data/
  questionnaire.json   question tree, texts and the hint catalogue
  rules.json           numbers from the law for the rules, sources, review flag
  evaluation.csv       test set of questions
  source/              official XML of the law
docs/project.md        how the project is built and why (in Russian)
reports/               quality evaluation reports
src/
  conversation/        conversation core, date parsing, typos
  questionnaire/       question tree, hint selection
  rules/               rules for entitlement and benefit duration
  session/             one-hour memory, "Forget everything"
  knowledge/           parsing the law, vectors, Qdrant, versions
  llm/                 requests to Gemini
  answer/              question path: rewriting, search, answer, refusals
  evaluation/          quality evaluation
  telegram/, console/  shells
  ingest.ts, search.ts, evaluate.ts   utility commands
```

## Adding a question or a hint

Only `data/questionnaire.json` is edited, no code is needed.

| Node type | What it does |
| --- | --- |
| `choice` | question with buttons |
| `date` | answer is a date |
| `periods` | answer is a list of jobs |
| `finding` | the bot applies a rule and reports the result |
| `message` | message without a question |
| `ask` | list of hints and free questions |
| `end` | end of the conversation |

A catalogue hint is an entry in `topics` of the `more` node: button label,
one-line description, question for the knowledge base, sections (`chunks`) and
the `showIf` condition (the person's situation, entitlement to benefit). The
tree is validated on start: a link to a missing node stops the program with a
clear error.

## Privacy

- Answers live only in the program's memory, for one hour. Message text is
  written neither to the console nor to files.
- Questionnaire answers are processed by code locally. Only free questions and
  the retrieved chunks of the law go to Gemini; the welcome message says so.
- The program has no HTTP server, and the Qdrant port is not exposed. Only the
  owner adds to the knowledge base, with a local command.
- The bot works in private chats only. It does not open photos, files or voice
  messages.
- "Forget everything" deletes the chat. Telegram only allows deleting messages
  younger than 48 hours.

## Limitations

- SGB III only. The Jobcenter (SGB II) and employment law are not in the base.
- The entitlement rule does not cover short fixed-term contracts (§ 142 (2)),
  overlap with an earlier qualifying period, or periods without contributions.
  The duration does not account for earlier benefit (the bot asks and then
  does not calculate) or reductions after a blocking period (the bot warns in
  words). Full list in `data/rules.json`, field `notCoveredYet`.
- In a general answer about benefit duration the model may say "within the last
  30 months", although § 147 counts employment over 5 years. The exact duration
  for the person is calculated by code in the questionnaire.
- Free Gemini limit: 500 requests a day for Flash Lite; a question takes two.
