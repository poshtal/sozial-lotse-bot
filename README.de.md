# SozialLotse

[Русский](README.md) | [English](README.en.md) | **Deutsch**

Ein russischsprachiger Telegram-Bot für Menschen in Deutschland, die ihre
Arbeit verloren haben oder verlieren könnten. Er stellt die Fragen selbst,
prüft nach den Regeln des Gesetzes den Anspruch auf Arbeitslosengeld und
dessen Dauer, zeigt, was der Person sonst noch zustehen könnte, und beantwortet
Fragen anhand des Textes des SGB III mit Angabe des Paragrafen.

Abschlussprojekt eines AI-Engineer-Kurses. Wie das Projekt aufgebaut ist und
warum, steht in [docs/project.md](docs/project.md) (auf Russisch).

> Dies ist eine Information, keine Rechtsberatung. Die endgültige Entscheidung
> trifft immer die Behörde.

![QR-Code des Bots](docs/qr-telegram.png)

## Funktionen

- **Fragebogen.** Die Situation per Button, Daten als freier Text („7 ноября“,
  „с 1 июля 24 по сейчас“); einen Tippfehler von einem Buchstaben korrigiert
  der Bot selbst. Wer die Kündigung schon erhalten hat, aber noch arbeitet,
  bekommt einen eigenen Button: Der Bot akzeptiert ein Datum in der Zukunft
  und erinnert sofort daran, sich innerhalb von 3 Tagen arbeitsuchend zu
  melden (§ 38).
- **Anspruch auf Arbeitslosengeld.** 12 Monate versicherungspflichtige
  Beschäftigung in den letzten 30 Monaten (§§ 142, 143 SGB III). Das rechnet
  der Code, nicht das Sprachmodell.
- **Anspruchsdauer.** 6 bis 24 Monate, je nach Versicherungszeit in 5 Jahren
  und Lebensalter (§ 147). Das Alter wird als Spanne abgefragt, die genaue Zahl
  ist nicht nötig.
- **„Was dir zustehen könnte“.** Bis zu 9 Hinweise aus einem Katalog, passend
  zur Situation der Person: Vermittlungsbudget, Coaching (AVGS),
  Weiterbildung, Gründungszuschuss, Nebeneinkommen, Insolvenzgeld und mehr.
- **Fragen zum Gesetz (RAG).** Antworten aus dem Text des SGB III mit Angabe
  des Paragrafen, danach 2–3 Buttons „Das wird auch gefragt“.
- **Ehrliche Absagen.** Fragen außerhalb des Themas, arbeitsrechtliche Fragen
  und Fragen, die das Gesetz nicht beantwortet, bekommen jeweils eine eigene
  Antwort. Der Bot erfindet nichts.
- **Speichert nichts.** Das Gedächtnis hält eine Stunde; der Button „Alles
  vergessen“ löscht das Gedächtnis und den Chatverlauf auf dem Bildschirm.

## Versionen

| Komponente | Version |
| --- | --- |
| Node.js | 22 |
| TypeScript | 5.9 |
| NestJS | 11 |
| grammY (Telegram) | 1.46 |
| Qdrant | Image `qdrant/qdrant:latest` |
| Modell für Antworten und Umformulierung | Gemini 3.5 Flash Lite |
| Embedding-Modell | Gemini Embedding 2 |
| Gesetz | SGB III, Stand 24.07.2026 |

## Start von Grund auf

Nötig sind Docker Desktop, ein Telegram-Konto und ein kostenloser
Gemini-API-Schlüssel.

1. **Telegram-Bot.** Schreibe [@BotFather](https://t.me/BotFather) den Befehl
   `/newbot` und speichere das Token.
2. **Gemini-Schlüssel.** Erstelle ihn auf [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. **Einstellungen.** Kopiere `.env.example` nach `.env` und trage
   `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY` und `GEMINI_EMBEDDING_MODEL` (die ID
   des Embedding-Modells aus AI Studio) ein. Alles andere ist schon ausgefüllt.
4. **Bauen:**
   ```bash
   docker compose build bot
   ```
5. **Das Gesetz in die Wissensbasis laden.** Einmalig, dauert einige Minuten:
   ```bash
   docker compose run --rm bot node dist/ingest.js
   ```
   Am Ende: „Готово: источник sgb-3, версия 1, кусков 385“.
6. **Starten:**
   ```bash
   docker compose up -d bot
   docker compose logs --tail 5 bot
   ```
   Im Log steht „Бот @name запущен“ (Bot gestartet).

**Prüfung.** Schreibe dem Bot `/start`, tippe auf „Окей“ und „Недавно уволили,
ничего не получаю“ (kürzlich gekündigt, bekomme nichts), dann frage
„дадут ли денег, если сам ушёл?“ (bekomme ich Geld, wenn ich selbst kündige?).

Erwartete Antwort: Wer ohne wichtigen Grund selbst kündigt, bekommt eine
Sperrzeit, in der Regel 12 Wochen, in manchen Fällen 3 oder 6; Quelle § 159
SGB III. Unter der Antwort erscheinen Buttons „Das wird auch gefragt“.

Telegram erlaubt pro Token nur eine laufende Kopie des Bots. Steht im Log
„Этот бот уже запущен в другом месте“ (läuft schon woanders), beende die
andere Kopie (zum Beispiel `npm run start` in einem anderen Fenster).

## Einstellungen in `.env`

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token von @BotFather. Leer: der Bot läuft in der Konsole | — |
| `INTERFACE` | `console` erzwingt die Konsole, auch wenn ein Token gesetzt ist | — |
| `SESSION_TTL_MINUTES` | nach wie vielen Minuten Stille der Bot das Gespräch vergisst | 60 |
| `GEMINI_API_KEY` | Gemini-API-Schlüssel | — |
| `GEMINI_EMBEDDING_MODEL` | Embedding-Modell. Nach einem Wechsel die Wissensbasis neu laden | — |
| `GEMINI_GENERATION_MODEL` | Modell, das anhand der gefundenen Paragrafen antwortet | `gemini-3.5-flash-lite` |
| `GEMINI_LIGHT_MODEL` | Modell, das die Frage umformuliert. Leer: dasselbe wie für Antworten | `gemini-3.5-flash-lite` |
| `LLM_TIMEOUT_MS` | wie lange auf das Modell gewartet wird, dann „später versuchen“ | 30000 |
| `LLM_RETRY_WAIT_MS` | Pause vor einer Wiederholung bei Überlastung (429, 503) | 4000 |
| `QDRANT_URL` | Adresse von Qdrant innerhalb von docker compose | `http://qdrant:6333` |
| `KNOWLEDGE_DB_COLLECTION_NAME` | Collection in Qdrant | `laws` |
| `TOP_K_VALUE` | wie viele Textabschnitte des Gesetzes die Suche an das Modell gibt | 8 |
| `MIN_RELEVANCE_SCORE` | Abschnitte unter diesem Ähnlichkeitswert werden verworfen | 0.57 |

Die Datei `.env` wird nicht ins Repository übernommen.

## Befehle

| Was | Befehl |
| --- | --- |
| Bot in der Konsole, ohne Telegram | `docker compose run --rm -e INTERFACE=console bot` |
| Gesetz laden (alle Paragrafen) | `docker compose run --rm bot node dist/ingest.js` |
| Nur ausgewählte Paragrafen laden | `docker compose run --rm bot node dist/ingest.js --paragraphs 136-164,81` |
| Suche prüfen, ohne Modellantwort | `docker compose run --rm bot node dist/search.js "Frage"` |
| Dasselbe ohne Umformulierung | `docker compose run --rm bot node dist/search.js --raw "Frage"` |
| Qualitätsprüfung | `docker compose run --rm -T bot node dist/evaluate.js > reports/evaluation.md` |
| Tests (241) | `npm test` |
| Start ohne Docker | `npm install`, dann `npm run start:dev` (Node.js 22 nötig) |

Das Gesetz lädt nur der Projektinhaber. Ein erneutes Laden desselben Textes
ändert nichts. Eine neue Fassung wird als neue Version geladen: Die vorherige
bleibt mit `active: false` in der Datenbank, und die Suche sieht sie nicht.

## Qualitätsprüfung

Der Testsatz liegt in `data/evaluation.csv`: 10 Fragen so formuliert, wie ein
Bekannter fragen würde, jede mit einer vorher festgelegten Erwartung.

| Erwartung | Was der Bot tun muss |
| --- | --- |
| `answer` | antworten und die richtigen Paragrafen nennen |
| `refuse` | ehrlich absagen: Thema passt, aber das Gesetz enthält keine Antwort |
| `partial` | nur eine Teilantwort ist möglich, ein Mensch bewertet sie |
| `out_of_scope` | sofort beim Umformulieren aussortieren |

| Lauf | Erfüllt | Prüfen | Nicht erfüllt | Bericht |
| --- | --- | --- | --- | --- |
| 47 Abschnitte des Gesetzes, 3.6 Flash | 7 | 2 | 1 (Google-Limit) | `reports/evaluation-before.md` |
| Ganzes SGB III, 3.6 Flash | 8 | 2 | 0 | `reports/evaluation-after.md` |
| Ganzes SGB III, verbesserte Antworten, 3.5 Flash Lite | 8 | 2 | 0 | `reports/evaluation-lite.md` |

Was die manuelle Prüfung gefunden hat und was daraufhin geändert wurde, steht
in [docs/project.md](docs/project.md) (Abschnitt 6, auf Russisch). Der Schalter
`-T` sorgt dafür, dass nur der Bericht in die Datei geht und der Fortschritt
auf dem Bildschirm bleibt.

## Wie der Bot eine Frage beantwortet

1. Ein leichtes Modell formuliert die Frage in den Begriffen des Gesetzes um:
   „bekomme ich Geld, wenn ich selbst kündige“ wird zu „Sperrzeit
   Arbeitsaufgabe ...“. Fragen außerhalb des Themas oder zum Arbeitsrecht
   bekommen sofort eine eigene Absage.
2. Qdrant liefert die 8 nächstgelegenen Abschnitte des Gesetzes, nur aus der
   aktuellen Fassung.
3. Abschnitte unter der Ähnlichkeitsschwelle werden verworfen. Bleibt keiner
   übrig, antwortet der Bot „das kann ich noch nicht“, das Modell wird nicht
   aufgerufen.
4. Das Modell antwortet nur anhand dieser Abschnitte, auf Russisch, und
   liefert JSON: den Text, die verwendeten Abschnitte und Fragen für „Das wird
   auch gefragt“.
5. Der Code prüft die Quellen: Gezeigt werden nur Abschnitte, die wirklich im
   Kontext waren.

Für Katalogpunkte und die Buttons „Das wird auch gefragt“ sind die Paragrafen
vorher bekannt, dort ist keine semantische Suche nötig.

## Struktur

```
data/
  questionnaire.json   Fragenbaum, Texte und Hinweiskatalog
  rules.json           Zahlen aus dem Gesetz für die Regeln, Quellen, Prüfvermerk
  evaluation.csv       Testsatz mit Fragen
  source/              amtliches XML des Gesetzes
docs/project.md        Aufbau des Projekts und Begründungen (auf Russisch)
reports/               Berichte der Qualitätsprüfung
src/
  conversation/        Gesprächskern, Datumserkennung, Tippfehler
  questionnaire/       Fragenbaum, Auswahl der Hinweise
  rules/               Regeln für Anspruch und Anspruchsdauer
  session/             Gedächtnis für eine Stunde, „Alles vergessen“
  knowledge/           Zerlegung des Gesetzes, Vektoren, Qdrant, Versionen
  llm/                 Anfragen an Gemini
  answer/              Weg einer Frage: Umformulierung, Suche, Antwort, Absagen
  evaluation/          Qualitätsprüfung
  telegram/, console/  Oberflächen
  ingest.ts, search.ts, evaluate.ts   Hilfsbefehle
```

## Eine Frage oder einen Hinweis hinzufügen

Geändert wird nur `data/questionnaire.json`, Code ist nicht nötig.

| Knotentyp | Was er tut |
| --- | --- |
| `choice` | Frage mit Buttons |
| `date` | Antwort ist ein Datum |
| `periods` | Antwort ist eine Liste von Beschäftigungen |
| `finding` | der Bot wendet eine Regel an und nennt das Ergebnis |
| `message` | Nachricht ohne Frage |
| `ask` | Liste der Hinweise und freie Fragen |
| `end` | Ende des Gesprächs |

Ein Katalogpunkt ist ein Eintrag in `topics` des Knotens `more`:
Button-Beschriftung, eine Zeile Beschreibung, Frage an die Wissensbasis,
Paragrafen (`chunks`) und die Bedingung `showIf` (Situation der Person,
Anspruch auf Arbeitslosengeld). Beim Start wird der Baum geprüft: Ein Verweis
auf einen fehlenden Knoten stoppt das Programm mit einer verständlichen
Fehlermeldung.

## Datenschutz

- Antworten liegen nur im Arbeitsspeicher des Programms, eine Stunde lang.
  Nachrichtentexte werden weder in die Konsole noch in Dateien geschrieben.
- Die Antworten des Fragebogens verarbeitet der Code lokal. An Gemini gehen
  nur freie Fragen und die gefundenen Abschnitte des Gesetzes; darauf weist
  die Begrüßung hin.
- Das Programm hat keinen HTTP-Server, der Port von Qdrant ist nicht nach
  außen offen. Die Wissensbasis ergänzt nur der Inhaber per lokalem Befehl.
- Der Bot arbeitet nur in privaten Chats. Fotos, Dateien und
  Sprachnachrichten öffnet er nicht.
- „Alles vergessen“ löscht den Chatverlauf. Telegram erlaubt nur das Löschen
  von Nachrichten, die jünger als 48 Stunden sind.

## Grenzen

- Nur SGB III. Jobcenter (SGB II) und Arbeitsrecht sind nicht in der Basis.
- Die Anspruchsregel berücksichtigt keine kurzen befristeten Verträge
  (§ 142 Abs. 2), keine Überschneidung mit einer früheren Rahmenfrist und
  keine Zeiten ohne Beiträge. Die Anspruchsdauer berücksichtigt keinen
  früheren Leistungsbezug (der Bot fragt danach und rechnet dann nicht) und
  keine Minderung durch eine Sperrzeit (der Bot weist mit Worten darauf hin).
  Vollständige Liste in `data/rules.json`, Feld `notCoveredYet`.
- In einer allgemeinen Antwort zur Anspruchsdauer kann das Modell „in den
  letzten 30 Monaten“ schreiben, obwohl § 147 die Beschäftigung über 5 Jahre
  zählt. Die genaue Dauer für die Person rechnet der Code im Fragebogen.
- Kostenloses Gemini-Limit: 500 Anfragen pro Tag für Flash Lite; eine Frage
  braucht zwei.
