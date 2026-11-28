# Проверка качества ответов, 2026-11-28

Вопросов: 10. Порог сходства: 0.57.

Совпало с ожиданием: **8**, не совпало: **0**, проверить глазами: **2**.

Поиск: нужный параграф попал в выдачу в 6 из 6 вопросов.

## Порог

- Нужные куски (вопросы с ответом): 0.711–0.806
- Куски у вопросов без ответа в базе: 0.694–0.716
- Оценки пересекаются: порогом их не разделить, отсев делает модель.

| № | Вопрос | Ожидание | Бот | Нужный § в поиске | Совпало | Почему |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | меня уволили, что делать? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 2 | дадут ли денег, если сам ушёл? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 3 | а если меня уволили незаконно? | отказать | не умею | — | да | честно отказал |
| 4 | помогут ли мне в Jobcenter или Arbeitsagentur найти работу? | частично | ответил | — | проверить | ответил: проверить, что не додумал недостающее |
| 5 | сколько я могу получать пособие? | ответить | ответил | 4-е место | да | ответил по нужным параграфам |
| 6 | если за полгода не найду работу, что дальше? | частично | не умею | 2-е место | проверить | отказал: проверить, не было ли в базе части ответа |
| 7 | можно ли подрабатывать, пока получаю пособие? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 8 | оплатят ли мне курсы или переобучение? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 9 | как продлить вид на жительство? | отсеять | не умею | — | да | отсеян как вопрос не по теме |
| 10 | как оформить Kindergeld? | отсеять | не умею | — | да | отсеян как вопрос не по теме |

## 1. меня уволили, что делать?

Ожидание: ответить. встать на учёт и заявить себя безработным
Нужные параграфы: § 38, § 141, § 137

Запрос для поиска: Arbeitslosengeld Kündigung durch Arbeitgeber Arbeitssuchendmeldung Frist persönliche Arbeitslosmeldung Pflicht zur Meldung Agentur für Arbeit

1. 0.743 проходит: SGB 3 § 141 Arbeitslosmeldung ← нужный
2. 0.736 проходит: SGB 3 § 38 Rechte und Pflichten der Ausbildung- und Arbeitsuchenden ← нужный
3. 0.711 проходит: SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit ← нужный
4. 0.704 проходит: SGB 3 § 159 Ruhen bei Sperrzeit
5. 0.703 проходит: SGB 3 § 138 Arbeitslosigkeit

Ответ бота:

> Если твое трудовое отношение заканчивается, по закону ты обязан сделать arbeitsuchend melden (регистрация в качестве ищущего работу) в Agentur für Arbeit (Агентство по труду) не позднее чем за три месяца до его окончания, а если ты узнал о дате окончания позже — в течение трех дней после получения информации. За несвоевременную регистрацию в качестве ищущего работу по закону может быть назначена Sperrzeit (период блокировки выплат). Чтобы получить выплаты, также необходимо сделать arbeitslos melden (регистрация в качестве безработного) лично в Agentur für Arbeit или через электронный портал. По закону право на Arbeitslosengeld (пособие по безработице) имеют те, кто является безработным, зарегистрировался в качестве безработного и выполнил Anwartschaftszeit (стаж ожидания).
> 
> Источник: SGB 3 § 141 Arbeitslosmeldung; SGB 3 § 38 Rechte und Pflichten der Ausbildung- und Arbeitsuchenden; SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit; SGB 3 § 159 Ruhen bei Sperrzeit
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 2. дадут ли денег, если сам ушёл?

Ожидание: ответить. Sperrzeit при уходе по своему желанию
Нужные параграфы: § 159

Запрос для поиска: Arbeitslosengeld Sperrzeit Arbeitsaufgabe Lösung des Beschäftigungsverhältnisses Arbeitnehmer wichtiger Grund

1. 0.741 проходит: SGB 3 § 159 Ruhen bei Sperrzeit ← нужный
2. 0.734 проходит: SGB 3 § 159 Ruhen bei Sperrzeit ← нужный
3. 0.674 проходит: SGB 3 § 161 Erlöschen des Anspruchs
4. 0.669 проходит: SGB 3 § 158 Ruhen des Anspruchs bei Entlassungsentschädigung
5. 0.658 проходит: SGB 3 § 140 Zumutbare Beschäftigungen

Ответ бота:

> По закону, если ты сам расторгаешь трудовые отношения без уважительной причины, выплата Arbeitslosengeld (пособие по безработице) приостанавливается на время Sperrzeit (период блокировки). Стандартная продолжительность Sperrzeit bei Arbeitsaufgabe (период блокировки при оставлении работы) составляет 12 недель. В определенных законом случаях этот срок может быть сокращен до 3 или 6 недель. Если для увольнения у тебя была уважительная причина, по закону ты должен сам изложить и доказать соответствующие факты.
> 
> Источник: SGB 3 § 159 Ruhen bei Sperrzeit
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 3. а если меня уволили незаконно?

Ожидание: отказать. трудового права нет в базе

Запрос для поиска: Unwirksamkeit der Kündigung Kündigungsschutzklage Arbeitslosengeld Ruhen des Anspruchs Beendigung des Beschäftigungsverhältnisses Sperrzeit Arbeitgeberkündigung

1. 0.716 проходит: SGB 3 § 158 Ruhen des Anspruchs bei Entlassungsentschädigung
2. 0.713 проходит: SGB 3 § 158 Ruhen des Anspruchs bei Entlassungsentschädigung
3. 0.709 проходит: SGB 3 § 157 Ruhen des Anspruchs bei Arbeitsentgelt und Urlaubsabgeltung
4. 0.698 проходит: SGB 3 § 156 Ruhen des Anspruchs bei anderen Sozialleistungen
5. 0.694 проходит: SGB 3 § 159 Ruhen bei Sperrzeit

Ответ бота:

> Этого я пока не умею: в моей базе нет текста закона, который отвечает на этот вопрос. С ним лучше идти в Arbeitsagentur (агентство по труду) или Jobcenter.

## 4. помогут ли мне в Jobcenter или Arbeitsagentur найти работу?

Ожидание: частично. § 35 о подборе работы не загружен

Запрос для поиска: Arbeitsvermittlung Beratung Vermittlungsdienste Eingliederung in Arbeit Unterstützung der Aufnahme einer Beschäftigung Maßnahmen zur Aktivierung

1. 0.744 проходит: SGB 3 § 45 Maßnahmen zur Aktivierung und beruflichen Eingliederung
2. 0.730 проходит: SGB 3 § 35 Vermittlungsangebot
3. 0.727 проходит: SGB 3 § 30 Berufsberatung
4. 0.722 проходит: SGB 3 § 37 Potenzialanalyse und Eingliederungsvereinbarung
5. 0.720 проходит: SGB 3 § 44 Förderung aus dem Vermittlungsbudget

Ответ бота:

> По закону Agentur für Arbeit (Агентство по труду) должно предлагать тебе Arbeitsvermittlung (трудоустройство) и Ausbildungsvermittlung (помощь в поиске места обучения). Сначала с тобой проведут Potenzialanalyse (анализ потенциала) для оценки твоих навыков и оформят Eingliederungsvereinbarung (соглашение об интеграции). Если твоё трудоустройство затруднено, по закону тебе обязаны предоставить усиленную поддержку. Кроме того, можно попросить финансовую помощь из Vermittlungsbudget (бюджет на трудоустройство) или пройти Maßnahmen zur Aktivierung und beruflichen Eingliederung (мероприятия по активации и профессиональной интеграции).
> 
> Источник: SGB 3 § 45 Maßnahmen zur Aktivierung und beruflichen Eingliederung; SGB 3 § 35 Vermittlungsangebot; SGB 3 § 37 Potenzialanalyse und Eingliederungsvereinbarung; SGB 3 § 44 Förderung aus dem Vermittlungsbudget
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 5. сколько я могу получать пособие?

Ожидание: ответить. двусмысленно: как долго (§ 147) или сколько денег (§ 149)
Нужные параграфы: § 147, § 149

Запрос для поиска: Höhe des Arbeitslosengeldes Dauer des Anspruchs Bemessungsentgelt Bemessungszeitraum Anwartschaftszeit Arbeitslosengeld

1. 0.738 проходит: SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit
2. 0.735 проходит: SGB 3 § 142 Anwartschaftszeit
3. 0.733 проходит: SGB 3 § 151 Bemessungsentgelt
4. 0.732 проходит: SGB 3 § 147 Grundsatz ← нужный
5. 0.726 проходит: SGB 3 § 152 Fiktive Bemessung

Ответ бота:

> По закону продолжительность выплаты Arbeitslosengeld (пособие по безработице) зависит от длительности ваших Versicherungspflichtverhältnisse (периодов обязательного страхования) за последние 30 месяцев и от вашего возраста. При стаже не менее 12 месяцев пособие выплачивается 6 месяцев, при 16 месяцах — 8 месяцев, при 20 месяцах — 10 месяцев, а при 24 месяцах стажа — 12 месяцев. Для людей старшего возраста сроки выше: после 50 лет и при 30 месяцах стажа — 15 месяцев; после 55 лет и при 36 месяцах стажа — 18 месяцев; после 58 лет и при 48 месяцах стажа — 24 месяца. При сокращенном стаже выплата составляет 3 месяца (за 6 месяцев стажа), 4 месяца (за 8 месяцев) или 5 месяцев (за 10 месяцев).
> 
> Источник: SGB 3 § 147 Grundsatz
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 6. если за полгода не найду работу, что дальше?

Ожидание: частично. срок пособия есть, Bürgergeld (SGB II) нет
Нужные параграфы: § 147

Запрос для поиска: Arbeitslosengeld Dauer des Anspruchs Erlöschen des Anspruchs Erschöpfung des Anspruchs Anspruchsdauer

1. 0.788 проходит: SGB 3 § 161 Erlöschen des Anspruchs
2. 0.763 проходит: SGB 3 § 147 Grundsatz ← нужный
3. 0.748 проходит: SGB 3 § 148 Minderung und Verlängerung der Anspruchsdauer
4. 0.726 проходит: SGB 3 § 143 Rahmenfrist
5. 0.726 проходит: SGB 3 § 439 Siebtes Gesetz zur Änderung des Dritten Buches Sozialgesetzbuch und anderer Gesetze

Ответ бота:

> Этого я пока не умею: в моей базе нет текста закона, который отвечает на этот вопрос. С ним лучше идти в Arbeitsagentur (агентство по труду) или Jobcenter.

## 7. можно ли подрабатывать, пока получаю пособие?

Ожидание: ответить. до 15 часов в неделю, зачёт дохода
Нужные параграфы: § 138, § 155

Запрос для поиска: Nebeneinkommen Nebentätigkeit Anrechnung von Nebeneinkommen Arbeitslosengeld Ausübung einer Beschäftigung weniger als 15 Stunden Freibetrag

1. 0.806 проходит: SGB 3 § 155 Anrechnung von Nebeneinkommen ← нужный
2. 0.722 проходит: SGB 3 § 151 Bemessungsentgelt
3. 0.711 проходит: SGB 3 § 156 Ruhen des Anspruchs bei anderen Sozialleistungen
4. 0.708 проходит: SGB 3 § 82c Anrechnung von Nebeneinkommen und sonstigen Zahlungen des Arbeitgebers
5. 0.706 проходит: SGB 3 § 157 Ruhen des Anspruchs bei Arbeitsentgelt und Urlaubsabgeltung

Ответ бота:

> По закону во время получения Arbeitslosengeld (пособие по безработице) ты можешь осуществлять Erwerbstätigkeit (трудовую деятельность). Однако полученный доход будет учитываться при выплате пособия. Из дохода за календарный месяц вычитаются налоги, социальные взносы, Werbungskosten (расходы на получение дохода), а также Freibetrag (необлагаемая сумма) в размере 165 Euro. Если это selbständige Tätigkeit (самостоятельная деятельность) или помощь родственникам в бизнесе, то в качестве расходов списываются 30 Prozent (процентов) от выручки, если ты не подтвердишь более высокие расходы.
> 
> Источник: SGB 3 § 155 Anrechnung von Nebeneinkommen
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 8. оплатят ли мне курсы или переобучение?

Ожидание: ответить. Bildungsgutschein
Нужные параграфы: § 81

Запрос для поиска: Förderung der beruflichen Weiterbildung Bildungsgutschein Umschulung Übernahme der Weiterbildungskosten Lehrgangskosten Notwendigkeit der Weiterbildung Eingliederung in den Arbeitsmarkt

1. 0.749 проходит: SGB 3 § 81 Grundsatz ← нужный
2. 0.739 проходит: SGB 3 § 81 Grundsatz ← нужный
3. 0.715 проходит: SGB 3 § 84 Lehrgangskosten
4. 0.712 проходит: SGB 3 § 82 Förderung beschäftigter Arbeitnehmerinnen und Arbeitnehmer
5. 0.709 проходит: SGB 3 § 83 Weiterbildungskosten

Ответ бота:

> По закону тебе могут оплатить расходы на berufliche Weiterbildung (профессиональное повышение квалификации), если это необходимо для твоего трудоустройства при безработице или для предотвращения угрожающей безработицы. До начала участия в программе тебя обязательно должно проконсультировать Agentur für Arbeit (Агентство по труду), а сама учебная программа и организатор должны иметь официальный допуск. При соблюдении этих условий тебе выдадут Bildungsgutschein (образовательный ваучер), который подтверждает право на поддержку. Также по закону можно попросить оплату курсов во время работы, если обучение длится более 120 часов и дает дополнительные профессиональные навыки.
> 
> Источник: SGB 3 § 81 Grundsatz; SGB 3 § 82 Förderung beschäftigter Arbeitnehmerinnen und Arbeitnehmer
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 9. как продлить вид на жительство?

Ожидание: отсеять. не по теме

Шаг переписывания: вопрос не по теме, поиск не делался.

Ответ бота:

> Этого я пока не умею: в моей базе нет текста закона, который отвечает на этот вопрос. С ним лучше идти в Arbeitsagentur (агентство по труду) или Jobcenter.

## 10. как оформить Kindergeld?

Ожидание: отсеять. похоже на тему, но это не SGB III

Шаг переписывания: вопрос не по теме, поиск не делался.

Ответ бота:

> Этого я пока не умею: в моей базе нет текста закона, который отвечает на этот вопрос. С ним лучше идти в Arbeitsagentur (агентство по труду) или Jobcenter.

