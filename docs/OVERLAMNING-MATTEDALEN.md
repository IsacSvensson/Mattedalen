# Överlämning: från Gångerträdgården till Mattedalen

Det här dokumentet är skrivet för den session som bygger Mattedalen i ett nytt repo. Det sammanfattar vad som är beslutat, vad som finns och kan tas med, vilka fällor som finns och i vilken ordning arbetet görs.

- Konceptet (version 2, efter granskning): https://claude.ai/artifact/2h1fr5YvhE9wf4yCy4g4jK
- Granskningen mot forskning, kursplan, skärmdebatt och juridik finns hos upphovspersonen (”Mattedalen: kritisk granskning mot forskning och svensk kontext”, oktober 2026). Be om den om den inte redan finns i den nya sessionen.
- Källkoden att utgå från: https://github.com/IsacSvensson/Multiplikation (grenen `main`).

## Beslut

| Fråga | Beslut |
|---|---|
| Målgrupp | **Hemmaspåret, cirka 7–9 år**, gärna med en vuxen. Inget skolspår förrän förslaget till ny kursplan lagts fram (senast 31 mars 2027). |
| Drift | **Ideellt, ingen server, inga konton.** Upphovspersonen ska inte behandla några personuppgifter. |
| Data | **Inget lämnar enheten.** Ingen analys, ingen felrapportering till molnet, inga typsnitt eller skript från andra värdar. Flytt sker bara med QR-kod eller fil som användaren själv hanterar. |
| Licens | **PolyForm Noncommercial 1.0.0** med raden `Required Notice: Copyright 2026 Isac Svensson (…)`. Licenserna för ingående delar följer med appen i `THIRD-PARTY-LICENSES.txt`. |
| Värd | GitHub Pages, publicerat med GitHub Actions. |
| Språk | Gränssnittet på svenska. Kod och kodkommentarer på engelska. |

## Pedagogiska regler (gäller alla platser)

- Varje steg är en fråga barnet själv svarar på (hämtningsövning). Utspridd repetition över dagar. En ny sak i taget bland många kända.
- Takten styrs mot hög framgångsgrad. Gickling och Thompson anger 70–85 % kända uppgifter vid drill. Inkrementell repetition använder 90 %. Jansen m.fl. (Math Garden) fann att högre framgång gav mer frivillig övning. Formulera det så, och överdriv inte.
- **Inga streaks, ingen valuta, inga kosmetiska upplåsningar, inga topplistor.** Världen visar vad barnet kan, inte vad barnet förtjänat. Innehåll öppnas när förkunskaperna finns, aldrig som belöning.
- Det som behöver repeteras ser **törstigt** ut. Inget vissnar och inget försvinner. Ett fel svar sänker en kunskap ett steg, men det visas aldrig som en förlust.
- **Ingen tidspress i det vanliga passet.** Det är ett eget försiktighetsval, inte ett forskningsresultat. Rekordjakt mot sig själv får finnas som frivilligt läge.
- Svåra kunskaper får **räknestigar**, alltså härledning från det barnet kan. Stödet trappas ner, och svaret på stigen räknas inte som bevis. Samma uppgift kommer tillbaka utan stöd, och då räknas den.
- Blandad övning införs gradvis, mellan sådant som går att förväxla. Belägget är svagt för 6–7 år.
- Representationer tonas ut (konkret, sedan prickar, sedan symboler) och kopplas alltid till symbolerna.
- Färg är aldrig den enda signalen. Allt ska kunna läsas upp. Stora knappar. Litet och konsekvent ordförråd.
- Barnet väljer i vilken ordning dagens platser besöks. Systemet väljer innehållet.

## Världens visuella regler

Från Gångerträdgården (se dess README, ”Designregler”, och överst i `src/game/styles.css`):

- Tre begrepp med var sitt uttryck som aldrig blandas: **tillgänglighet** (marken eller platsen), **kunskap** (det som växer eller fylls) och **hela områden** (kanten och landskapet).
- Samma kontur (`--outline`, 2,5 px) överallt. Tryckskugga (`--press`, 4 px) bara på det man kan trycka på. Tre hörnradier.
- Fredoka för rubriker och siffror, Nunito för text, båda lokalt i appen (OFL). Ritade SVG-ikoner och tolv djur, inga emojis.
- En orange huvudknapp per skärm. Rätt svar i grönt med text, fel svar lugnt och streckat, aldrig rött.

## Ta med från Gångerträdgården

Allt nedan är testat: cirka 230 enhetstester och 75 e2e-tester.

| Del | Var | Kommentar |
|---|---|---|
| Faktamotorn | `src/engine` | Innehållsoberoende. Pass, takt, Leitner, status, upplåsning, fokusläge, räknestigar (`support.ts`), startkoll (`placement.ts`), dagens tid räknas ihop (`meta.today`). |
| Lagring | `src/storage` | IndexedDB med migreringar, minnesreserv, kompaktering av loggen, säkerhetskopia (JSON) och QR-ögonblicksbild. |
| PWA | `src/sw`, `vite.config.ts`, `src/game/pwa.ts` | Service worker som skapas vid bygget. Uppdateringar som når även en installerad app (`e2e/update.spec.ts`). |
| Designsystem | `src/game/styles.css`, `src/game/components/{icons,avatars,scene,plant}.ts` | Ikoner, djur, landskap och solrosor. |
| Skärmar | `src/game/screens` | Profiler, föräldravy med PIN, startkoll, tabellval, rekordjakt och duell. |
| Innehåll | `src/content/multiplication` | Blir Trädgårdens paket. |
| Simulerade elever | `tests/simulation` | ACT-R-modell för att pröva motorn. |
| Testskydd | `e2e/offline.spec.ts`, `e2e/narrow.spec.ts`, `e2e/landscape.spec.ts` | Inga anrop till andra värdar, smala telefoner (320 och 360 px) och liggande telefon. Behåll dem. |
| Licens och CI | `LICENSE.md`, `scripts/third-party-licenses.mjs`, `.github/workflows` | Kopieras som de är. |

Enklast är att skapa det nya repot med Gångerträdgårdens historik (spegla `main`) och sedan bygga om strukturen, så att historiken och testerna följer med.

## Fällor: läs innan något publiceras

1. **Samma ursprung som Gångerträdgården.** Båda apparna ligger på `https://isacsvensson.github.io/`, och IndexedDB och cachar delas per ursprung, inte per sökväg.
   - Gångerträdgårdens service worker **raderar alla cachar som börjar med `gangertradgarden-`** och inte är dess egen (`src/sw/sw-template.js`). Mattedalen måste ha ett annat prefix, till exempel `mattedalen-`, annars raderar apparna varandras cachar.
   - Databasen heter `gangertradgarden` (`DB_NAME` i `src/storage/idb.ts`). Mattedalen ska ha en egen databas, till exempel `mattedalen`, och vid första start **importera** profiler, framsteg, vuxenkod och inställningar från `gangertradgarden` om den finns. Barnens trädgårdar följer då med automatiskt, och den gamla databasen lämnas orörd. Skriv ett e2e-test för det.
   - Säkerhetskopians format heter `gangertradgarden-profil` (`src/storage/backup.ts`). Mattedalen ska kunna läsa det gamla formatet.
2. **Standardgren.** I Multiplikation-repot är standardgrenen fortfarande `ccr-…`, och publiceringen körs bara från standardgrenen. I det nya repot ska `main` vara standardgren från början. Ställ in GitHub Pages på ”GitHub Actions”.
3. **Kursplanen.** Kopplingarna till Lgr22 i konceptet är sammanfattade och ska stämmas av mot Skolverkets officiella text. Kontrollera särskilt om pengar ingår i centralt innehåll för åk 1–3. Progressionen anges i nivåer eller ålder, inte i årskurser, eftersom beteckningarna ändras 2028.

## Arkitektur att sikta mot

- **Kunskapskomponenter är kärnan.** Ett innehållspaket deklarerar kunskapskomponenter med id, förkunskapskanter (graf), uppgiftsgeneratorer (med felsvar kopplade till kända missuppfattningar), representationsnivåer och en bemästringsmodell. Platserna är vyer över grafen.
- Gångerträdgårdens faktor (`Item`) motsvarar en kunskapskomponent av typen fakta. Bygg om stegvis: **gör grafen när Bäcken behöver den**, inte i förväg.
- **Bemästring mäts med separata kontrolluppgifter.** Träffsäkerheten i ett adaptivt urval pressas mot målnivån och visar inte vad barnet kan.
- **Exportformatet** (JSON och QR) versioneras per kunskapskomponent.
- **Ett skal:** dalens karta som startsida, gemensamma profiler och djur, föräldravy för alla platser och ett dagligt pass som kan fördelas mellan platserna.

## Ordning

1. **Nytt repo** med Gångerträdgårdens historik. Gör `main` till standardgren, ställ in Pages och CI, och byt namn på databasen och cacheprefixet med import enligt fälla 1.
2. **Skalet:** dalens karta som startsida, med Trädgården som enda öppna plats. Inget får ändras för barnen i trädgården, och befintliga tester ska vara gröna.
3. **Bäcken:** addition och subtraktion inom 20 och sedan 100, som faktafamiljer. Linjär, numrerad tallinje där barnet säger talen. Tiokamrater, dubblor och övergång via tiotalet. Likhetstecknet i varierade format från första veckan (`7 + 5 = __ + 8`, `__ = 3 + 4`, `6 = 6`). Räknestigar. Här byggs grafen över kunskapskomponenter.
4. **Analoga spel:** ett utskrivbart brädspel (numrerad bana 1–100) och kortlekar för tiokamrater och Gångerkrig. Ett ”spela med en vuxen”-kort i veckan.
5. **Pilot** med 6–10 barn: kontroll på uppgiftsnivå (en tränad och en otränad halva per barn), förskjuten start, mätning utanför appen, samma test efter fyra veckor och samtycke från vårdnadshavare.
6. **Dammen** (taluppfattning) och **Bikupan** (positionssystemet med växling åt båda hållen), med den nya uppgiftstypen för förståelse.

## Arbetssätt som fungerat

- Planera först och vänta på godkännande. Bygg sedan i faser och stanna efter varje fas.
- Typkontroll, enhetstester, bygge och e2e (surfplatta och telefon) körs före varje push. Lägg till ett e2e-test för varje fel som hittas på en riktig enhet.
- Ta skärmbilder av nya skärmar på 360 px bredd, liggande telefon och surfplatta innan de visas för upphovspersonen.
- Commit-meddelanden skrivs på svenska.
- Svenska användartexter skrivs enkelt och direkt.
