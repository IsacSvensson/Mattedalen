# Plan: inför piloten (R5 och S4)

Det piloten behöver av appen och av dokumenten: en fil med barnets svar som den
vuxna själv väljer att skicka, frågor att ställa till barnen, och en ärlig text
om vad appen tränar och inte tränar.

## Varför

- **Piloten mäter.** 6–10 barn spelar i fyra veckor ([överlämningen](OVERLAMNING-MATTEDALEN.md#ordning)).
  Den som håller i piloten behöver se hur barnen svarar: vad som blir buskar, var
  de fastnar och vilka fel de gör. I dag finns det bara i säkerhetskopian, och den
  innehåller barnets namn.
- **Inget lämnar enheten av sig själv.** Det gäller också piloten. Filen sparas
  på enheten, och den vuxna väljer om den ska skickas.
- **Barnens egen bild.** Granskningen ville veta om barnen förstår växterna, vad
  som ändras och hur man får hjälp. Det kan bara barnen svara på.
- **Appen är ett komplement.** Den tränar en del av matematiken i åk 1–3, inte hela
  kursplanen. Det ska stå tydligt.

## Hur

### Loggexporten (R5a)

- **Var:** barnets inställningar i ”För vuxna”, under ”Flytta eller spara”: knappen
  ”Fil till piloten…”. Den leder till en egen sida.
- **Sidan** säger vad som finns i filen och vad som inte finns där. Den vuxna
  skriver en pilotkod, till exempel ”P03”, och sparar filen. Koden sparas för
  barnet, så att den står där nästa gång.
- **I filen:** pilotkoden, appens version, barnets inställningar som påverkar
  övningen, varje plats med alla fakta och hur de ligger till, alla pass och alla
  svar (fakta, rätt eller fel, svaret, tiden, form och slag av fråga), och
  sammanfattningen av äldre svar.
- **Inte i filen:** namnet, djuret och profilens id. Barnet heter bara pilotkoden.
- **Filen** heter till exempel `mattedalen-pilot-P03-2026-10-17.json`. Den sparas
  som en vanlig nedladdning. Appen skickar den inte.

### Frågor till piloten (R5b)

- **`docs/PILOT.md`:** hur filen sparas och skickas, och frågorna att ställa.
- **Till barnen,** efter en vecka och efter fyra veckor: vad växterna betyder, vad
  som ändras när de svarar rätt och fel, hur man får hjälp, vad som är roligt och
  vad som är tråkigt.
- **Till de vuxna:** om föräldravyn är begriplig, om ”Att göra för dig” hjälper,
  och om ”Ge mer tid” behövdes.
- **Öppna frågor från granskningarna:** trädgårdens former (räcker färre steg för en
  7-åring?), om kart behövs, gränsen 3,7 s för ”Ge mer tid”, och om genomsnittliga
  barn får träd.

### Appens syfte (S4)

- **README:** ett kort avsnitt ”Vad appen tränar och inte tränar”.
- **`docs/LGR22.md`:** appens delar mot det centrala innehållet i matematik för
  åk 1–3. Skolverkets webbplats går inte att nå härifrån. Texten skrivs därför
  utifrån kursplanens rubriker och markeras som ej avstämd, tills någon har
  jämfört med Skolverkets text.

## Faser

| Fas | Innehåll |
|---|---|
| R5a. Loggexporten **(klar)** | Sidan ”Fil till piloten”, pilotkoden, filen utan namn. Tester. |
| R5b. Frågor till piloten | `docs/PILOT.md` med frågorna och hur filen skickas. |
| S4. Appens syfte | README och `docs/LGR22.md`. |

## Fallgropar

- **Namnet får inte smita med.** Filen byggs av en lista med det som ska med, inte
  genom att ta bort fält ur säkerhetskopian. Ett nytt fält i profilen hamnar då
  inte i filen av misstag.
- **Loggen slås ihop** efter cirka 3 500 svar. Fyra veckor är ungefär 3 000 svar,
  så sammanfattningen av äldre svar måste med.
- **Den otränade halvan.** Pilotens upplägg håller hälften av uppgifterna utanför
  övningen. Motorn kan det redan (uteslutna fakta), men det går inte att ställa
  in i appen. Det hör till pilotens egen plan, som kommer efter den här.

## Fynd från R5a

- **Sidan ”Fil till piloten”** nås från barnets inställningar. Den räknar upp vad
  som finns i filen, med antalet svar och pass, och säger att namnet inte finns
  där. Utan pilotkod sparas ingen fil.
- **Filen** (`mattedalen-pilot-P03-2026-10-17.json`) har formatet
  `mattedalen-pilot`, version 1. Enhetstestet söker efter namnet, djuret och
  profilens id i hela filen. Ett nytt fält i inställningarna kommer inte med.
- **Fakta som aldrig har frågats** är inte med. Filen blir då mindre, och det som
  saknas är nytt.
- **Pilotkoden** sparas för barnet på enheten, inte i profilen. Den följer alltså
  inte med i säkerhetskopian eller QR-koden.
- **Sidan** ryms på 320 px utan sidledsscroll, och e2e-testet kontrollerar
  filens innehåll.
