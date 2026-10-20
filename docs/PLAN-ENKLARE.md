# Plan: enklare att förstå (E)

Appen ska vara lättare att förstå, för barn och för vuxna. Planen bygger på två
granskningar i oktober 2026: en genomgång av appen i telefonstorlek, som nytt
barn och som förälder, och en granskning av koden av en annan AI. Båda kom fram
till samma sak. Grunden och bildspråket ska vara kvar. Det som behövs är att det
blir tydligare vad man ska göra, hur man hittar och vad framstegen betyder.

## Faser

| Fas | Innehåll | Storlek |
|---|---|---|
| E1. Snabba rättelser | Diagrammet visar 7 dagar, ”I dag” får text, ”Passlängd” blir ”Tid per dag”, och inställningarna får enklare ord. | Liten |
| E2. Första starten för den vuxna | En kort introduktion som går att hoppa över: vad appen tränar, tid per dag, uppläsning, var ”För vuxna” finns och var datan sparas. Den vuxna väljer startkollen. Sedan ”Lämna över till barnet”. | Mellan |
| E3. Mindre läsning för barnet | Högtalarknapp på hjälpkorten och första skärmen, kortare hjälptext, en hand som visar draget på kartan, och skylten för dagens plats som rör sig. | Mellan |
| E4. Förklaringar vid behov | ”Vad betyder växterna?” (och stenarna och lyktorna) med bilder, vad ”sitter” betyder, en mening per barn och ”Så kan du hjälpa till”, säkerhetskopian efter vad man vill göra, och en påminnelse varje månad. | Mellan |

E2–E4 planeras i detalj när E1 är klar. Varje fas kommer först i testversionen
([PLAN-TESTVERSION](PLAN-TESTVERSION.md)) och släpps när den är provad.

## E1. Snabba rättelser

Små ändringar som inte ändrar hur appen fungerar, bara hur den säger saker.

### 1. Diagrammet: senaste 7 dagarna

- **I dag:** rubriken säger ”Den här veckan”, men staplarna visar 14 dagar, och
  texten under räknar 7. Det är ett fel (`src/shell/screens/parent/parent.ts`).
- **Nu:** rubriken blir ”Senaste 7 dagarna”, och diagrammet visar de 7 dagarna.
- **Dagarna** står som veckodagar (”mån”, ”tis”), med i dag sist. Det är lättare
  att läsa än datum.
- **Texten under** blir kortare, eftersom rubriken redan säger vilka dagar det
  gäller: ”38 minuter, 4 dagar med spel.”

### 2. ”I dag” med text

- **I dag:** solen i hörnet av kartan har ingen synlig text. Den heter ”Det här
  kan du göra i dag” bara för skärmläsare. En sjuåring vet inte att solen är en
  knapp.
- **Nu:** ordet ”I dag” står under solen, som namnet under en app på hemskärmen.
  Knappen blir inte bredare, så raden längst upp ryms också på 320 px.
- **Pricken** finns kvar när något återstår i dag.
- **När dagen är klar** står det fortfarande ”I dag”. Rutan som öppnas säger
  redan vad som vilar. Inga poäng och ingen svit av dagar.

### 3. ”Passlängd” blir ”Tid per dag”

- **I dag:** inställningen styr hela dagens tid, som delas mellan högst två
  platser. Ordet ”Passlängd” låter som ett enda pass.
- **Nu:** ”Tid per dag”, med texten: ”Hur länge barnet övar per dag, allt
  tillsammans. Appen delar tiden mellan platserna efter vad som behöver
  repeteras.”
- **Samma ord överallt:** raden ”Barnets inställningar” i översikten,
  piloten och dokumenten.

### 4. Enklare ord i inställningarna

| I dag | Nu |
|---|---|
| Fritt svar med sifferknappar när en fakta sitter (annars bara flerval) | Skriva svaret själv när barnet kan en fakta, i stället för att välja bland svar |
| Tabellerna väntar på det de bygger på vid stigen | Vänta med en tabell tills barnet kan det den bygger på vid Stigen. Till exempel väntar ×4 på att dubbla och halvera. |
| Läs upp frågorna och dalens platser (svenska) | Läs upp frågorna och platserna med en svensk röst på enheten |
| Ge mer tid: ”En buske kräver då svar under … sekunder i stället för …” | Först i vardagsspråk: ”För ett barn som svarar rätt men långsamt. Växterna växer då också med lite längre svarstid.” Sekunderna kommer efter. |
| Att göra: ”Webbläsaren kan radera barnens framsteg om utrymmet tar slut.” och knappen ”Be om beständig lagring” | ”Webbläsaren kan rensa sparad data när enheten får ont om plats. Be den att behålla barnens framsteg.” och knappen ”Behåll framstegen” |

Exemplet för tabellerna hämtas ur samma lista som appen använder, så att det
alltid stämmer.

### Nytt i appen

En post: ”Enklare ord för vuxna”. Diagrammet visar senaste veckan, solen heter
”I dag”, och ”Passlängd” heter ”Tid per dag”.

### Tester och kontroll

- **E2e:** diagrammet har 7 staplar med veckodagar, ”I dag” syns under solen,
  ”Tid per dag” sparas, och de nya texterna finns. Befintliga tester som letar
  efter ”Passlängd” eller ”Det här kan du göra i dag” uppdateras.
- **Skärmbilder** i 320 och 360 px, och på surfplatta: kartans överkant,
  översikten och barnets inställningar. Inget får sticka ut åt sidan.
- **Skärmläsaren:** solen heter ”I dag. Det här kan du göra i dag” och diagrammet
  läser upp veckodag och minuter.

## Beslut som behövs

Jag går på förslagen nedan om du inte säger annat.

1. **”I dag” under solen** (förslag), eller solen och texten i en bredare knapp.
   En bredare knapp tränger raden längst upp på 320 px.
2. **Veckodagar** under staplarna (förslag), eller datum som i dag.
3. **”Tid per dag”** (förslag), eller ”Dagens övningstid” som granskningen
   föreslog.

## Fallgropar

- **Ordet ”sitter”** står kvar i E1. Vad det betyder förklaras i E4, så att
  förklaringen stämmer med motorns regler.
- **Testerna** letar efter knappar och fält med namn. Namnbytena gör att flera
  e2e-tester måste ändras i samma ändring.
- **Nyheten** kommer först i testversionen. Den vanliga appen får den när E1
  släpps.
