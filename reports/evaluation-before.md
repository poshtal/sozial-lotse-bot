# Проверка качества ответов, 2026-11-27

Вопросов: 10. Порог сходства: 0.57.

Совпало с ожиданием: **7**, не совпало: **1**, проверить глазами: **2**.

Поиск: нужный параграф попал в выдачу в 6 из 6 вопросов.

## Порог

- Нужные куски (вопросы с ответом): 0.708–0.805
- Куски у вопросов без ответа в базе: 0.691–0.709
- Оценки пересекаются: порогом их не разделить, отсев делает модель.

| № | Вопрос | Ожидание | Бот | Нужный § в поиске | Совпало | Почему |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | меня уволили, что делать? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 2 | дадут ли денег, если сам ушёл? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 3 | а если меня уволили незаконно? | отказать | не умею | — | да | честно отказал |
| 4 | помогут ли мне в Jobcenter или Arbeitsagentur найти работу? | частично | ответил | — | проверить | ответил: проверить, что не додумал недостающее |
| 5 | сколько я могу получать пособие? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 6 | если за полгода не найду работу, что дальше? | частично | не умею | 1-е место | проверить | отказал: проверить, не было ли в базе части ответа |
| 7 | можно ли подрабатывать, пока получаю пособие? | ответить | ответил | 1-е место | да | ответил по нужным параграфам |
| 8 | оплатят ли мне курсы или переобучение? | ответить | сбой | 1-е место | НЕТ | сбой: модель или база недоступны |
| 9 | как продлить вид на жительство? | отсеять | не умею | — | да | отсеян как вопрос не по теме |
| 10 | как оформить Kindergeld? | отсеять | не умею | — | да | отсеян как вопрос не по теме |

## 1. меня уволили, что делать?

Ожидание: ответить. встать на учёт и заявить себя безработным
Нужные параграфы: § 38, § 141, § 137

Запрос для поиска: Kündigung durch Arbeitgeber Pflicht zur Arbeitsuchendmeldung Arbeitslosmeldung Frist Anspruch auf Arbeitslosengeld Agentur für Arbeit

1. 0.712 проходит: SGB 3 § 38 Rechte und Pflichten der Ausbildung- und Arbeitsuchenden ← нужный
2. 0.712 проходит: SGB 3 § 141 Arbeitslosmeldung ← нужный
3. 0.708 проходит: SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit ← нужный
4. 0.690 проходит: SGB 3 § 159 Ruhen bei Sperrzeit
5. 0.689 проходит: SGB 3 § 138 Arbeitslosigkeit

Ответ бота:

> По закону, при увольнении тебе необходимо сделать `arbeitsuchend melden` (зарегистрироваться как ищущий работу) в `Agentur für Arbeit` (Агентство по трудоустройству) не позднее чем за три месяца до окончания работы. Если о дате увольнения стало известно менее чем за три месяца, тебе нужно зарегистрироваться в течение трех дней после получения этого известия. Также тебе нужно лично или онлайн сделать `arbeitslos melden` (зарегистрироваться как безработный). Чтобы претендовать на `Arbeitslosengeld` (пособие по безработице), по закону нужно быть безработным, зарегистрироваться в агентстве и выполнить `Anwartschaftszeit` (стаж уплаты страховых взносов). Обрати внимание, что за несвоевременное обращение может быть назначена `Sperrzeit` (период блокировки выплат).
> 
> Источник: SGB 3 § 38 Rechte und Pflichten der Ausbildung- und Arbeitsuchenden; SGB 3 § 141 Arbeitslosmeldung; SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit; SGB 3 § 159 Ruhen bei Sperrzeit
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 2. дадут ли денег, если сам ушёл?

Ожидание: ответить. Sperrzeit при уходе по своему желанию
Нужные параграфы: § 159

Запрос для поиска: Arbeitslosengeld Sperrzeit Arbeitsaufgabe Eigenkündigung Lösung des Beschäftigungsverhältnisses wichtiger Grund

1. 0.744 проходит: SGB 3 § 159 Ruhen bei Sperrzeit ← нужный
2. 0.737 проходит: SGB 3 § 159 Ruhen bei Sperrzeit ← нужный
3. 0.672 проходит: SGB 3 § 161 Erlöschen des Anspruchs
4. 0.670 проходит: SGB 3 § 158 Ruhen des Anspruchs bei Entlassungsentschädigung
5. 0.654 проходит: SGB 3 § 138 Arbeitslosigkeit

Ответ бота:

> По закону, если ты увольняешься по собственному желанию и без уважительной причины (wichtiger Grund), наступает Sperrzeit (период блокировки выплат). В это время выплата Arbeitslosengeld (пособия по безработице) приостанавливается. Стандартная продолжительность Sperrzeit (периода блокировки) при самостоятельном увольнении составляет 12 недель. При определенных условиях этот срок может быть сокращен до 3 или 6 недель. Если у тебя была уважительная причина уйти с работы, тебе нужно будет изложить и доказать эти факты.
> 
> Источник: SGB 3 § 159 Ruhen bei Sperrzeit
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 3. а если меня уволили незаконно?

Ожидание: отказать. трудового права нет в базе

Запрос для поиска: Arbeitslosengeld Sperrzeit Kündigungsschutzklage Unwirksamkeit der Kündigung Beendigung des Beschäftigungsverhältnisses Arbeitgeberkündigung

1. 0.709 проходит: SGB 3 § 159 Ruhen bei Sperrzeit
2. 0.709 проходит: SGB 3 § 159 Ruhen bei Sperrzeit
3. 0.699 проходит: SGB 3 § 161 Erlöschen des Anspruchs
4. 0.697 проходит: SGB 3 § 158 Ruhen des Anspruchs bei Entlassungsentschädigung
5. 0.691 проходит: SGB 3 § 158 Ruhen des Anspruchs bei Entlassungsentschädigung

Ответ бота:

> Этого я пока не умею: в моей базе нет текста закона, который отвечает на этот вопрос. С ним лучше идти в Arbeitsagentur (агентство по труду) или Jobcenter.

## 4. помогут ли мне в Jobcenter или Arbeitsagentur найти работу?

Ожидание: частично. § 35 о подборе работы не загружен

Запрос для поиска: Arbeitsvermittlung Beratung Eingliederung in Arbeit Unterstützung bei der Arbeitsuche Arbeitsförderung Agentur für Arbeit

1. 0.691 проходит: SGB 3 § 38 Rechte und Pflichten der Ausbildung- und Arbeitsuchenden
2. 0.686 проходит: SGB 3 § 138 Arbeitslosigkeit
3. 0.658 проходит: SGB 3 § 164 Anordnungsermächtigung
4. 0.658 проходит: SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit
5. 0.653 проходит: SGB 3 § 141 Arbeitslosmeldung

Ответ бота:

> По закону Agentur für Arbeit (Агентство по трудоустройству) проводит консультации и помогает в поиске работы. После твоей регистрации в качестве arbeitsuchend (ищущий работу) ведомство должно незамедлительно провести с тобой консультационное собеседование — Beratungs- und Vermittlungsgespräch (собеседование по консультированию и трудоустройству), а также Berufsberatung (профессиональная консультация). Посредничество в трудоустройстве — Arbeitsvermittlung (содействие в трудоустройстве) — проводится, пока ты получаешь выплаты при безработице или до указанного срока окончания договора. Кроме того, после наступления безработицы Agentur für Arbeit также обязана без промедления провести личную беседу по трудоустройству.
> 
> Источник: SGB 3 § 38 Rechte und Pflichten der Ausbildung- und Arbeitsuchenden; SGB 3 § 141 Arbeitslosmeldung
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 5. сколько я могу получать пособие?

Ожидание: ответить. двусмысленно: как долго (§ 147) или сколько денег (§ 149)
Нужные параграфы: § 147, § 149

Запрос для поиска: Arbeitslosengeld Dauer des Anspruchs Anspruchsdauer Höhe des Arbeitslosengeldes Bemessungsentgelt Leistungssatz Bemessungszeitraum

1. 0.767 проходит: SGB 3 § 147 Grundsatz ← нужный
2. 0.758 проходит: SGB 3 § 150 Bemessungszeitraum und Bemessungsrahmen
3. 0.752 проходит: SGB 3 § 151 Bemessungsentgelt
4. 0.741 проходит: SGB 3 § 152 Fiktive Bemessung
5. 0.740 проходит: SGB 3 § 149 Grundsatz ← нужный

Ответ бота:

> По закону размер Arbeitslosengeld (пособие по безработице) составляет 60 % от pauschaliertes Nettoentgelt (паушального нетто-дохода), а при наличии хотя бы одного ребёнка у тебя или твоего супруга — 67 %. Длительность выплат зависит от срока уплаты страховых взносов и твоего Lebensalter (возраста). Например, при страховом стаже от 12 месяцев пособие выплачивается 6 месяцев, а максимальный срок в 24 месяца возможен при стаже от 48 месяцев и возрасте от 58 лет. Расчёт выплат привязан к твоему заработку за Bemessungszeitraum (расчётный период).
> 
> Источник: SGB 3 § 147 Grundsatz; SGB 3 § 150 Bemessungszeitraum und Bemessungsrahmen; SGB 3 § 149 Grundsatz
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 6. если за полгода не найду работу, что дальше?

Ожидание: частично. срок пособия есть, Bürgergeld (SGB II) нет
Нужные параграфы: § 147

Запрос для поиска: Arbeitslosengeld Dauer des Anspruchs Anspruchsdauer Erschöpfung des Anspruchs Entstehen des Anspruchs

1. 0.761 проходит: SGB 3 § 147 Grundsatz ← нужный
2. 0.758 проходит: SGB 3 § 161 Erlöschen des Anspruchs
3. 0.733 проходит: SGB 3 § 148 Minderung und Verlängerung der Anspruchsdauer
4. 0.724 проходит: SGB 3 § 137 Anspruchsvoraussetzungen bei Arbeitslosigkeit
5. 0.722 проходит: SGB 3 § 143 Rahmenfrist

Ответ бота:

> Этого я пока не умею: в моей базе нет текста закона, который отвечает на этот вопрос. С ним лучше идти в Arbeitsagentur (агентство по труду) или Jobcenter.

## 7. можно ли подрабатывать, пока получаю пособие?

Ожидание: ответить. до 15 часов в неделю, зачёт дохода
Нужные параграфы: § 138, § 155

Запрос для поиска: Arbeitslosengeld Nebeneinkommen Nebenbeschäftigung Anrechnung von Nebeneinkommen Ausübung einer Beschäftigung weniger als 15 Stunden wöchentlich Freibetrag

1. 0.805 проходит: SGB 3 § 155 Anrechnung von Nebeneinkommen ← нужный
2. 0.731 проходит: SGB 3 § 151 Bemessungsentgelt
3. 0.718 проходит: SGB 3 § 138 Arbeitslosigkeit ← нужный
4. 0.710 проходит: SGB 3 § 156 Ruhen des Anspruchs bei anderen Sozialleistungen
5. 0.708 проходит: SGB 3 § 162 Teilarbeitslosengeld

Ответ бота:

> По закону ты можешь вести Erwerbstätigkeit (трудовая деятельность), пока получаешь Arbeitslosengeld (пособие по безработице), но рабочее время должно составлять менее 15 часов в неделю. Если работать 15 часов в неделю и больше, статус безработного теряется. Заработанный доход учитывается при расчете пособия после вычета налогов, социальных взносов, расходов на работу и Freibetrag (необлагаемая сумма) в размере 165 Euro в месяц. При самостоятельной деятельности по закону автоматически вычитываются 30 процентов дохода как расходы, если ты не докажешь более высокие расходы.
> 
> Источник: SGB 3 § 155 Anrechnung von Nebeneinkommen; SGB 3 § 138 Arbeitslosigkeit
> 
> Это пересказ закона, а не решение по твоему случаю: его принимает ведомство.

## 8. оплатят ли мне курсы или переобучение?

Ожидание: ответить. Bildungsgutschein
Нужные параграфы: § 81

Запрос для поиска: Förderung der beruflichen Weiterbildung Umschulung Bildungsgutschein Übernahme der Weiterbildungskosten Lehrgangskosten Notwendigkeit

1. 0.756 проходит: SGB 3 § 81 Grundsatz ← нужный
2. 0.731 проходит: SGB 3 § 81 Grundsatz ← нужный
3. 0.719 проходит: SGB 3 § 82 Förderung beschäftigter Arbeitnehmerinnen und Arbeitnehmer
4. 0.715 проходит: SGB 3 § 84 Lehrgangskosten
5. 0.710 проходит: SGB 3 § 87a Weiterbildungsprämie und Weiterbildungsgeld

Ответ бота:

> Сейчас не получилось ответить: база знаний или сервис, который формулирует ответы, недоступны. Попробуй ещё раз через минуту.

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

