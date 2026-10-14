# Gångerträdgården

Ett forskningsbaserat webbspel som lär barn 6–9 år multiplikationstabellen 1–10.
Spelet är en offline-PWA utan backend. All data stannar i webbläsaren.

> **Status:** Alla sju faser är klara: motor och innehåll, lagring, spelet med hela
> tabellen, interaktiv introduktion, strategiåterkoppling, fritt svar, föräldravy,
> flytt mellan enheter (QR och JSON), offline-PWA på GitHub Pages samt utmaning,
> tvåspelarläge och uppläsning.
>
> **Spela:** https://isacsvensson.github.io/Multiplikation/

## Kom igång

```bash
npm install
npm test            # alla tester, inklusive simulerade elever (~20 s)
npm run typecheck   # app, motor (utan DOM-typer) och tester
npm run dev         # utvecklingsserver
npm run build       # typkontroll + statiskt bygge till dist/
npm run e2e         # webbläsartester (Playwright, surfplatta + mobil)
```

Kräver Node 20 eller senare.

## Arkitektur

```
src/
  engine/                   innehållsneutral inlärningsmotor (ren logik)
  content/multiplication/   innehållspaketet: fakta, enheter, strategier, distraktorer
  storage/                  ProgressStore, IndexedDB, säkerhetskopior
  game/                     spelskal och UI (vanilla TS + liten h()-hjälpare)
tests/
  engine/                   enhetstester för motorn (med ett glosor-paket)
  content/                  tester för multiplikationspaketet
  simulation/               simulerade elever över 26 veckor
  storage/                  samma kontraktstester för minne och IndexedDB
  game/                     spelets styrlogik (utan DOM)
e2e/                        Playwright: hela flöden i riktig webbläsare
```

### Motorn (`src/engine`)

Motorn är ren och deterministisk:

- **Inga DOM- eller lagringsberoenden.** Den kompileras med en egen tsconfig utan
  DOM-typer (`tsconfig.engine.json`). Ett test kontrollerar dessutom att den bara
  importerar egna moduler och inte nämner multiplikation.
- **Klocka och slump injiceras** (`Clock`, `Rng`). Tester och simuleringar använder
  `ManualClock` och `seededRng`.
- **Ändrar inget tillstånd.** Varje svar ger en ny `ItemState` och ett `Attempt`
  som spelet själv sparar.

```ts
const engine = createEngine({ pack, clock, rng });
const session = engine.startSession({ states, meta });   // mode: 'daily' | 'extra' | 'focus'
for (let q = session.next(); q; q = session.next()) {
  // q.kind: warmup | new | rehearse | retry | due | mixed
  // q.format: 'choice' (med q.choices) eller 'free'
  const fb = session.submit(svar, svarstidMs);           // { correct, state, attempt, item.hints … }
}
const { meta, introduced, accuracy } = session.summary();
```

**Datamodell.** Den följer byggprompten med två förfiningar:

- `ItemState.dueDay` är en kalenderdag (`YYYY-MM-DD`) i stället för en tidpunkt,
  eftersom passen går per dag.
- `correctDays` är ersatt av `dayBest`: bästa korrekta svarstid per dag och
  svarsformat. Både gränsen för ”flytande” och gränsen för ”automatiserad” räknas
  ut ur samma data, så trösklarna går att ändra i efterhand.

**Statusregler** (`status.ts`, konfigurerbara i `config.ts`):

| Status | Krav |
|---|---|
| ny → inlärning | när faktan introduceras |
| flytande | rätt under 5 s på 2 olika dagar (flerval eller fritt svar) |
| automatiserad | rätt under 3 s på 3 olika dagar, **med fritt svar** |
| fel svar | ett steg ner; nivån måste sedan visas på en ny dag |

Två svar räknas aldrig som bevis: svar samma dag som faktan introducerades, och
rätt svar efter ett fel samma dag. I båda fallen har barnet nyss sett svaret.

**Spridd repetition** (`leitner.ts`): Leitner-lådor med intervallen 1, 2, 4, 7, 14
och 30 dagar. Bara ett rätt svar på en förfallen fakta flyttar den uppåt. Ett fel
skickar den till låda 0.

**Passets sammansättning** (`session.ts`). Passet byggs fråga för fråga, så att det
kan sluta på tid:

1. Omfrågning av fel svar (cirka 3 frågor senare) och repetition av nya fakta
   (2, 5 och 10 frågor efter introduktionen).
2. Uppvärmning med 5 säkra fakta.
3. En ny fakta när `pacingGap` kända fakta har frågats sedan den förra
   (inkrementell repetition). När barnet kan få fakta introduceras färre nya:
   3 + 1 per 4 kända, högst 12 per pass.
4. Förfallna repetitioner, med de svagaste först, blandat över alla enheter.
5. Blandad övning viktad mot svaga fakta, fakta som snart ska repeteras och fakta
   som inte frågats nyligen i passet. Samma fakta kommer aldrig två gånger i rad.

**Takt** (`pacing.ts`). Andelen rätt över de senaste 10 svaren styr avståndet
mellan nya fakta, inom intervallet 3–14 kända. Över 90 % rätt kommer nya fakta
tätare. Under 80 % glesas de ut och pausas. Avståndet sparas mellan passen.

**Upplåsning** (`unlock.ts`). Nästa enhet låses upp när cirka 80 % av den aktuella
enheten är flytande. Antalet avrundas nedåt, så små enheter blir inte strängare:
3 av 4 räcker. En upplåst enhet låses aldrig igen. Ligger barnet över målbandet
räcker 60 % (`easyUnlockFraction`), annars tar det slut på nytt material att öva
på. Sätt värdet till 0,8 för att stänga av lättnaden.

**Fokuspass** (`mode: 'focus'`, `focusItemIds`). Ett frivilligt pass riktat mot
en vald grupp fakta, till exempel en tabell. Cirka 70 % av frågorna i steg 4–5
tas ur gruppen (`config.focus.share`) och resten ur allt annat barnet kan. Att
öva en tabell helt för sig känns effektivt men fastnar sämre än blandad övning,
och barnet kan då svara på mönstret i stället för faktan. Passet får plantera
högst 3 nya fakta ur gruppen (`config.focus.maxNew`) med samma takt som vanligt,
även om faktans enhet inte är upplåst än. Enheten låses inte upp av det, så
dagens pass fortsätter i ordning. Ett fokuspass räknas aldrig som dagens pass.
Innehållspaketet beskriver valbara grupper med `focusSets` (`FocusSet`).

**Svåra fakta: räknestigen** (`support.ts`, `mode`-oberoende). En fakta räknas
som svår om barnet har svarat fel på den på 2 olika dagar, om den har fallit
tillbaka från flytande 2 gånger eller om den har övats i mer än 7 dagar utan att
bli flytande (`config.support`). När en svår fakta kommer upp frågas den i stället
som `derive`, men bara om de fakta den härleds från (`item.derivedFrom`) redan är
flytande, högst en gång per dag och högst 3 gånger per pass. Spelet går då steg
för steg från det barnet kan: 5 × 7 = 35 → 35 + 7 → 6 × 7. Svaret på stigen räknas
inte som bevis och sänker inte heller faktan, eftersom barnet fick hjälp. Några
frågor senare kommer samma fakta tillbaka som en vanlig fråga, och det svaret
räknas. Klarar barnet faktan ur minnet på en senare dag nollställs räkningen
(`settledDay`), och stigen visas inte längre. Stödet trappas alltså ner mot att
plocka fram svaret ur minnet, och härledningen blir inte en permanent omväg.
Utan fritt svar (inställning i föräldravyn) används ingen stig.

**Svarsformat.** Nya fakta och fakta under inlärning frågas med flerval
(4 alternativ). Flytande fakta frågas med fritt svar. Distraktorerna kommer från
innehållspaketet, och barnets egna tidigare felsvar blandas in med hög vikt.

### Multiplikationspaketet (`src/content/multiplication`)

Paketet innehåller 100 fakta (1–10 × 1–10). **×0 är utelämnat**, eftersom det
ligger utanför 10×10-kartan. Speglade fakta som 3×7 och 7×3 är separata items
kopplade med `pairId`.

| Ordning | Enhet | Antal fakta | Strategi |
|---|---|---|---|
| 1 | ×10 | 19 | ”7 tiotal = 70” |
| 2 | ×2 | 17 | 7 + 7 |
| 3 | ×5 | 15 | hälften av ×10 |
| 4 | ×1 | 13 | en grupp med … |
| 5 | ×4 | 11 | dubbla ×2 |
| 6 | ×3 | 9 | ×2 + ett gäng |
| 7 | Kvadrattal (6², 7², 8², 9²) | 4 | t.ex. 7×7 = 5×7 + 2×7 |
| 8 | ×9 | 6 | ×10 − ett gäng |
| 9 | ×6 | 4 | ×5 + ett gäng |
| 10 | ×7 och ×8 | 2 | 8×7 = dubbla 4×7 |

Varje fakta hör till den första enhet vars tabell den ingår i, så 3×7 lärs in med
×3 och 7×9 med ×9. `derivedFrom` pekar alltid på fakta i tidigare enheter. Varje
fakta har tre ledtrådar:

- `strategy`, till exempel ”8 × 7 = dubbla 4 × 7 = 28 + 28 = 56”
- `array`, med rader × kolumner för rektangelmönstret
- `swap`, till exempel ”3 × 7 är lika mycket som 7 × 3”

Distraktorerna är grannprodukter i samma tabell (6×8 mot 7×8), addition i stället
för multiplikation, omvända siffror (54/45) samt ±1- och ±10-fel.

### Lagring (`src/storage`)

Spelet pratar bara med gränssnittet `ProgressStore`, så lagringen kan bytas mot en
backend senare utan att motorn eller spelet ändras. Gränssnittet har:

- profiler
- framsteg per profil och innehållspaket (`load`, `save`)
- svarslogg (`appendAttempt`)
- pass
- säkerhetskopior (`export`, `import`)
- små appinställningar, till exempel föräldra-PIN

Det finns två implementationer. **`IndexedDbProgressStore`** bygger på `idb`.
**`MemoryProgressStore`** används i tester och som reserv när IndexedDB är
blockerat, till exempel i vissa privata lägen. Båda körs mot samma kontraktstester.

| Objektlager | Nyckel | Innehåll |
|---|---|---|
| `profiles` | `id` | namn, avatar, inställningar (passlängd, uppläsning, fritt svar) |
| `progress` | `[profileId, packId]` | alla `ItemState` + `LearnerMeta` |
| `attempts` | autoinkrement, index `[profileId, ts]` | svarsloggen |
| `sessions` | `[profileId, id]` | ett litet kvitto per pass (minuter per dag, resultat) |
| `daySummaries` | `[profileId, packId, dag, itemId]` | sammanfattning av äldre loggposter |
| `settings` | nyckel | appinställningar |

- **Migrationer.** `MIGRATIONS` är en lista där index *n* uppgraderar till version
  *n + 1*. Databasversionen är listans längd. Nya migrationer läggs till sist och
  släppta migrationer ändras aldrig. Exportformatet har en egen versionskedja i
  `backup.ts`.
- **Loggens storlek.** `maybeCompactLog` behåller de senaste 3 000 försöken per
  profil när loggen har vuxit 500 poster förbi det. Äldre försök slås ihop till
  antal, antal rätt och total svarstid per dag och fakta. Förväxlingarna finns
  kvar i `ItemState.confusions`.
- **Beständig lagring.** `requestPersistence()` anropas när appen startar och
  anropar `navigator.storage.persist()`. Svaret (`persisted`, `not-persisted` eller
  `unsupported`) visas i föräldravyn i fas 5.
- **Säkerhetskopia (JSON).** `export` ger en fullständig kopia av en profil,
  inklusive loggen. `import` validerar och reparerar trasiga poster och skriver
  allt i en enda transaktion. Om profilen redan finns importeras den som en kopia,
  om man inte väljer `onConflict: 'replace'`.

### Spelet (`src/game`)

Spelet är skrivet i vanilla TypeScript med en liten `h()`-hjälpare (`dom.ts`). Det
har få skärmar och lite delat tillstånd, så ett UI-ramverk skulle bara ge vikt.
All grafik är inbäddad SVG: plantor, djur (`components/avatars.ts`), ikoner
(`components/icons.ts`) och landskapet (`components/scene.ts`). Typsnitten
(Fredoka och Nunito, SIL OFL, licenser i `src/game/fonts/`) följer med appen, så
inget hämtas utifrån.

- **`play.ts`** (`PlayController`) kopplar ihop motorn och lagringen utan DOM.
  Efter varje svar sparas försöket och faktans tillstånd. När passet är slut sparas
  passets kvitto och elevens meta. Avbryter barnet passet tidigt finns framstegen
  kvar, men dagen räknas inte som klar. Allt detta testas med minneslagringen.
- **Profiler.** Flera barn kan använda samma enhet, och varje barn har namn och ett
  djur.
- **Kartan** är 10×10-rutnätet som en odlingslåda av trä. Raden *a* och kolumnen
  *b* visar *a × b*, så 3×7 och 7×3 speglas över diagonalen. Vad rutorna betyder
  beskrivs under Designregler nedan. Fakta som just har vuxit animeras.
- **Introduktion av nya fakta.** Barnet drar ut rektangeln på en bräda med
  10 × 10 prickar och ser storleken medan det drar, till exempel ”3 × 6”. En
  speglad rektangel kan vridas 90° med ”Vrid”. Kan barnet redan tvillingen
  (7 × 3) börjar brädet från den, och barnet vrider den till 3 × 7. ”Visa mig”
  bygger rektangeln åt barnet. När den är rätt visas strategin som färgade delar,
  till exempel 8 × 7 som två 4 × 7-halvor eller 9 × 6 som 10 × 6 där sista raden
  är struken. Sedan svarar barnet själv (”Nu du!”).
- **Svarsformat.** Fakta under inlärning frågas med flerval: fyra stora knappar,
  och tangenterna 1–4 fungerar. Flytande fakta frågas med fritt svar på en stor
  sifferknappsats (siffror, sudda och bock, eller tangentbordet). Fritt svar krävs för
  statusen ”automatiserad”. Svarstiden mäts men visas aldrig, och ingen klocka
  syns.
- **Räknestigen** (`derivationSteps` i `content/multiplication/derive.ts`). Stegen
  följer faktans strategi: en grupp till (6 × 7 från 5 × 7), dela upp och lägg
  ihop (7 × 7 = 5 × 7 + 2 × 7), dubbla (8 × 7 från 4 × 7), ta bort en grupp
  (9 × 6 från 10 × 6) och hälften (5 × 8 från 10 × 8). Varje steg besvaras på
  sifferknappsatsen, med rektangeln i färgade delar bredvid. Ett fel steg visar
  bara talet, och stigen fortsätter. Föräldravyn visar ”Svåra just nu” med samma
  strategi, så att vuxna kan prata om samma knep.
- **Återkoppling.** Vid rätt svar blir frågekortet grönt, svaret visas och en
  liten planta dyker upp. Vid fel ersätts frågan av ett hjälpkort: ”Du svarade 54.
  Så här kan du tänka:”, rätt svar, strategin och den färgade rektangeln. Aldrig
  bara ”fel” och aldrig rött. Är felsvaret en typisk förväxling får barnet en vänlig
  förklaring (”48 är 8 × 6 – nära!”, ”7 är 3 + 4. Här ska det vara 3 gånger 4.”).
  Felsvaret loggas som förväxling.
- **Avbrutet pass.** Lämnar barnet passet i förtid och kommer tillbaka samma dag,
  fortsätter samma pass: övad tid och antal nya fakta räknas ihop över dagen
  (`meta.today`). Dropparna fortsätter där de var, dagen blir klar när summan når
  hela tiden, och barnet får inga extra nya fakta för att det började om. Tiden
  sparas efter varje svar, så den räknas även om appen bara stängs.
- **Avslutningen.** När tiden är slut (12 minuter som standard) får barnet svara
  klart på frågan och ser sedan ”Trädgården behöver sova nu” med vad som växte.
  Under resten av dagen sover trädgården. Extra övning är frivillig, märkt som
  frivillig, varar 5 minuter och ger inga nya fakta.

### Designregler

Utseendet bygger på några få regler. De står också överst i `styles.css`.

**Tre begrepp, tre egna visuella uttryck.** De blandas aldrig:

| Begrepp | Uttrycks bara genom | Värden |
|---|---|---|
| Tillgänglighet (spelvärlden) | rutans **bakgrund** | äng = inte upplåst · grävd jord = upplåst |
| Kunskap (barnets lärande) | **växten** på rutan | ingen · frö · planta · buske · träd |
| Hela tabeller | **odlingslådans kant och kullen** | solros på tabellens siffra · en solros på kullen |

- Växterna följer statusreglerna i motorn. Frö och planta betyder att faktan
  övas, buske att den är flytande (rätt och snabbt på 2 olika dagar) och träd att
  den är automatiserad (3 dagar, utan alternativ). Ett fel svar sänker faktan ett
  steg, och växten visar då den lägre nivån. Nedgången visas inte som en händelse.
- En tabell (till exempel ×7, alla 19 fakta i båda ordningarna) räknas som kunnig
  när alla dess fakta är minst buskar. Då blir siffran på lådan en solros, och en
  solros växer på kullen i landskapet. Hela raden ändras inte, eftersom varje
  fakta hör till två tabeller.

**Form.**

- Samma kontur överallt: `--outline` (2,5 px, mörkbrun).
- Bara det man kan trycka på har en skugga under sig, och den är alltid lika djup
  (`--press`, 4 px). Ytor som bara visar något har ingen skugga, till exempel
  kort, odlingslådan och siffrorna under rutnätet.
- Tre hörnradier: `--r-card` för kort, `--r-tile` för rutor och svarsknappar,
  samt rund eller piller för knappar.
- Typsnitt: Fredoka för rubriker och siffror, Nunito för text.
- En huvudknapp per skärm (orange). Övriga val är ljusa.
- Rätt svar visas i grönt. Fel svar visas lugnt och streckat, aldrig i rött.
- Inga emojis i gränssnittet. Profilerna sparar fortfarande djuret som emoji, så
  äldre profiler och säkerhetskopior fungerar, men det ritas som SVG.

### Föräldravy (`src/game/screens/parent`)

Föräldravyn nås via ”För vuxna” på startsidan. Den skyddas av en fyrsiffrig
vuxenkod som väljs första gången. Koden är ingen säkerhetsfunktion, eftersom
datan ändå finns på enheten. Den finns bara för att barn inte ska hamna där av
misstag. Den som glömt koden besvarar en additionsfråga för vuxna och väljer
sedan en ny.

För varje barn visar vyn:

- antal fakta per status, antal fullständiga pass, senaste speldag och
  upplåsta enheter
- en **värmekarta** över 10×10-rutnätet. En tryckning på en ruta visar status,
  antal försök, andel rätt, genomsnittlig svarstid och vanligaste felsvar.
- de **vanligaste förväxlingarna**, till exempel ”7 × 8 – svarade 48 (3 gånger)”
- **övade minuter per dag** under de senaste 14 dagarna
- inställningar: namn, djur, passlängd 10–15 minuter, fritt svar av/på
- att flytta barnet till en annan enhet, eller ta bort profilen

Vyn visar också enhetens lagringsstatus: om beständig lagring är beviljad, med en
knapp för att be om den, och hur mycket utrymme som används. Där förklaras också
varför det minskar risken att data raderas om appen läggs på hemskärmen.

### Flytta mellan enheter

- **QR-kod** (`storage/qrCodec.ts`). Koden innehåller status per fakta i 3 bitar
  (status plus ungefärlig Leitner-låda), namn, djur och passlängd, skyddat med
  CRC-8. Datan base45-kodas, så att QR-kodens kompakta alfanumeriska läge kan
  användas. Hela barnet ryms i cirka 90 tecken, vilket ger en QR-kod av version
  5–6 som är lätt att skanna. På mottagande enhet väljer man ”Skanna QR-kod” och
  använder kameran. Det går också att fotografera koden och välja bilden.
  Avläsningen använder `BarcodeDetector` där den finns, annars `jsqr`, som bara
  laddas när den behövs. Status, repetitionsschema och upplåsta enheter
  återskapas. Finns redan ett barn med samma namn väljer man om det ska ersättas.
- **JSON-säkerhetskopia** med allt, även hela loggen. Den sparas som fil och
  öppnas på den andra enheten. Finns profilen redan väljer man mellan ”Ersätt”
  och ”Lägg till som kopia”.

Båda vägarna testas i e2e mellan två separata webbläsarkontexter. QR-koden testas
också i enhetstester genom att den ritas till pixlar och läses av med jsQR.

### Startkoll (placering)

Ett barn som redan kan ×10, ×2, ×5 och ×1 ska inte behöva gå igenom dem igen.
Därför erbjuds en frivillig **startkoll** när en ny spelare skapas, och den kan
göras om från föräldravyn.

- **Motorn** (`engine/placement.ts`) är innehållsneutral. Den går igenom
  enheterna i ordning och frågar 4 slumpade fakta ur varje.
- **Godkänd enhet:** minst 3 av 4 rätt, och varje rätt svar ska komma inom 5 s.
  Den som räknar på fingrarna får alltså inte enheten godkänd.
- **Andra chans:** med exakt två fel i en enhet kommer 2 extra frågor som båda
  måste vara rätt, alltså 4 av 6. Ett enstaka felslag stoppar då inte ett barn
  som kan enheten.
- **Slut:** kollen stannar vid den första enhet som inte klaras.
- **Svaren** ges på sifferknappsatsen, eftersom flerval ger för mycket
  gissning. Ingen rätt- eller fel-markering visas och ingen klocka syns.
- **Resultat** (`applyPlacement`): fakta i godkända enheter blir *flytande*
  (buskar), inte automatiserade, och enheterna låses upp fram till den första
  som inte klarades. De placerade fakta läggs in för repetition utspritt över
  den första veckan. En för generös placering rättas därför av den vanliga
  repetitionen, eftersom ett fel svar sänker faktan ett steg. Startkollen kan
  bara flytta fram ett barn, aldrig bakåt.
- **Simulering:** genomsnittliga elever som redan övat de fyra lätta tabellerna
  placeras vid ×4 (7 av 8 frön) efter cirka 19 frågor. Den åttonde placeras
  lite lägre, vid ×2, vilket är den säkra sidan. Efter placeringen ligger
  andelen rätt på 80–93 %, och efter sex veckor är minst 8 av 10 enheter
  upplåsta.

### Extralägen

Extralägena är frivilliga och tydligt valbara under huvudknappen i trädgården.
De påverkar inte schemaläggningen.

- **Öva en tabell** (`screens/focus.ts`). Barnet väljer ×1–×10. Varje
  tabell visar en liten stapel över hur mycket som är buskar och plantor. En
  runda är 5 minuter och körs som ett fokuspass (se motorn ovan). Tabellen
  omfattar båda ordningarna (×7 är 1 × 7 … 10 × 7 och 7 × 1 … 7 × 10, 19 fakta)
  och går därför över flera enheter. Barnet får själv välja en tabell som inte
  är upplåst än, eftersom passet ändå bara planterar några få nya fakta åt gången.
  Från samma vy finns **rekordjakt på en tabell**. Den öppnas när 4 av tabellens
  fakta är buskar och har ett eget rekord per tabell (`focusId` på passet).
- **Slå rekord** (`screens/challenge.ts`). Barnet har 90 sekunder och
  får bara fakta som redan är minst ”flytande”. Läget öppnas när 5 fakta är
  buskar. Här, och bara här, syns en tidsstapel. Ett fel svar ger inget straff:
  rätt svar visas en kort stund och spelet fortsätter. Poängen jämförs bara med
  barnets eget bästa resultat (”Nytt rekord!”), aldrig med andra barn.
- **Gångerkrig – barn mot vuxen** (`screens/duel.ts`). Två spelare på samma
  enhet, inspirerat av multiplikationskrig med kortlek. Båda drar ett kort ur
  barnets kända fakta, så att den vuxna inte får lättare kort. Barnet svarar med
  flerval och den vuxna på sifferknappsatsen. Störst rätt svar tar rundan. Blir
  det lika är det ”krig”, och nästa runda är värd dubbelt. Ett spel är 7 rundor.
- **Uppläsning** (`speech.ts`). Uppläsningen slås på per barn i föräldravyn och
  använder Web Speech API med en svensk röst (`sv-SE`). Frågan läses upp så som
  barn säger den (”3 gånger 7”), och en 🔊-knapp läser upp den igen. Svarstiden
  börjar mätas först när frågan är uppläst, så uppläsningen gör inte barnets
  svarstid längre. Saknas en svensk röst på enheten står det i föräldravyn.

Logiken för båda spelen (`challenge.ts`) är rena funktioner med egna tester.
Spelen sparas som pass med `mode: 'challenge'` respektive `'duel'`, och
tabellövning som `mode: 'focus'`.

### PWA och offline

- **Manifest** (`public/manifest.webmanifest`): svenskt namn, `display: standalone`
  och relativa sökvägar, så att appen fungerar under vilken undersökväg som helst.
  Ikonerna (192, 512, maskable och Apple) renderas från `public/icons/icon.svg`
  med `node scripts/make-icons.mjs`.
- **Service worker** (`src/sw/sw-template.js`). Ett litet Vite-plugin
  (`swPlugin` i `vite.config.ts`) skriver `dist/sw.js` efter bygget. Det
  innehåller listan över alla byggda filer och en version som är en hash av
  filerna. Workern cachar bara appens egna statiska filer och svarar
  cache-first. Navigering får den cachade `index.html`. Allt annat lämnas
  orört, och ingen data går över nätet.
- **Uppdateringar** (`pwa.ts`). Appen letar efter en ny version när den startar,
  när den kommer tillbaka i förgrunden, när nätet kommer tillbaka och var 30:e
  minut. En ny version laddas ner i bakgrunden och väntar. Sedan gäller:
  - Fanns den redan när appen startade, tas den i bruk direkt, innan något har
    spelats. En installerad app stängs sällan helt, så annars skulle den vänta
    för evigt.
  - Annars visas knappen ”Ny version finns – uppdatera” längst ner på alla
    skärmar utom under ett spel (pass, rekordjakt, duell, startkoll). Appen byts
    aldrig ut mitt i ett spel. Byter en annan flik version, laddas den här om
    först när spelet är slut.
  - Föräldravyn visar vilken version som körs (byggdatum och commit) och har
    knappen ”Sök efter uppdatering”, som söker direkt och startar om med den nya
    versionen.
  `sw.js` hämtas alltid förbi webbläsarens cache (`updateViaCache: 'none'`), och
  installationen hämtar varje fil med `cache: 'reload'`.
- **Installation.** En vänlig banderoll på startsidan och en guide i
  föräldravyn visar hur man lägger till appen på hemskärmen. Guiden har steg för
  iPhone och iPad (Safari → Dela → Lägg till på hemskärmen), för Android och för
  dator. Där webbläsaren erbjuder det, som Chrome och Edge, finns också en egen
  installationsknapp. Installerad körs appen i helskärm, och webbläsaren raderar
  inte datan lika lätt.
- **Tester.** E2e-testet laddar appen en gång, stänger av nätet, spelar, öppnar
  föräldravyn och läser en QR-bild, där läsarbiblioteket laddas först då. Testet
  kontrollerar att varje svar kom från service workern och att inget anrop gick
  till någon annan värd.
  `e2e/update.spec.ts` publicerar en ny version under testet och kontrollerar att
  den erbjuds, att den aldrig dyker upp mitt i ett spel, att en nedladdad version
  tas i bruk vid nästa start och att föräldravyns knapp fungerar.

### Integritet

Appen sätter inga cookies och har ingen spårning, analys eller reklam. All data
(IndexedDB) och appens egna filer (Cache API) lagras bara på enheten och behövs
för att tjänsten ska fungera. Därför krävs inget samtyckesformulär enligt lagen
om elektronisk kommunikation (9 kap. 28 §). Ingen data lämnar enheten om inte
föräldern själv exporterar den. Föräldravyn har en kort integritetstext.
Värden, GitHub Pages, loggar IP-adresser enligt GitHubs integritetspolicy.

### Publicering på GitHub Pages

`.github/workflows/deploy.yml` bygger och publicerar repots **standardgren**
(`main`) vid varje push. Det kan också startas manuellt under *Actions → Publicera på GitHub
Pages → Run workflow*. Enhetstesterna körs först. Engångsinställning: välj
**Settings → Pages → Build and deployment → Source: GitHub Actions** i repot.
Appen hamnar då på `https://<användare>.github.io/<repo>/`.
`.github/workflows/ci.yml` kör typkontroll, enhetstester, bygge och
Playwright-tester vid varje push och pull request.

### Återanvända motorn för annat innehåll

Ett innehållspaket implementerar `ContentPack`:

```ts
const glosor: ContentPack = {
  id: 'glosor', version: 1, title: 'Engelska djur',
  items: [{ id: 'hund', prompt: 'hund', answer: 'dog', unitId: 'djur', tags: [],
            derivedFrom: [], hints: [{ kind: 'text', text: 'hund = dog' }], order: 0 }, /* … */],
  units: [{ id: 'djur', title: 'Djur', order: 0, itemIds: ['hund' /* … */], unlockRule: { kind: 'always' } }],
  normalizeAnswer: (s) => s.trim().toLowerCase(),
  distractorCandidates: (item) => /* andra svar i samma enhet */ [],
  focusSets: [{ id: 'djur', title: 'Djur', itemIds: ['hund' /* … */] }], // valfritt
};
const engine = createEngine({ pack: glosor });
```

Ledtrådarna (`Hint`) är data som motorn bara skickar vidare. Spelet bestämmer hur
de visas. Motorns enhetstester använder just ett sådant glosor-paket
(`tests/engine/fixtures.ts`).

## Simulerade elever

`tests/simulation/learner.ts` modellerar eleven med ACT-R-modellen för
faktainlärning, där glömskan beror på hur utspridd övningen är (Pavlik & Anderson,
2005). Varje övning lämnar ett minnesspår, och tät övning glöms snabbare än
utspridd. Modellen innehåller också:

- överföring mellan speglade fakta
- härledning från källfakta
- gissning vid flerval
- svarstider som sjunker med minnesstyrkan

Den **genomsnittliga eleven är kalibrerad mot tidslinjen i forskningsunderlaget**
(hela tabellen på cirka 3–6 månader för en 8–9-åring) och inte mot målet för
andelen rätt. Så ser resultaten ut för 26 veckors simulerad övning, cirka 6 dagar
i veckan, med 10 slumpfrön:

| Elev | Andel rätt under inlärningsfasen | Alla fakta introducerade | Automatiserade efter 26 v |
|---|---|---|---|
| svag | 81–83 % | – (cirka 85 av 100) | 0–1 |
| genomsnittlig | **87,7–89,3 %** | efter 7–9 veckor | 87–95 |
| stark | 96–97 % | efter 3–4 veckor | 97–100 |

Inlärningsfasen räknas tills alla fakta är introducerade. Därefter är passen ren
befästning och blir lättare, vilket är väntat.

**Kända begränsningar:**

- Den starka eleven ligger över 90 % eftersom motorn inte introducerar fler än
  12 nya fakta per pass och inte hoppar över enheter.
- Den svaga eleven når sällan ”automatiserad”, eftersom den simulerade svarstiden
  sällan går under 3 s. Gränsen går att ändra i `config.ts`.

## Licens

Gångerträdgården är ett ideellt projekt, fritt att använda för att barn ska lära sig matematik.

- **Koden och grafiken** omfattas av [PolyForm Noncommercial License 1.0.0](LICENSE.md). Alla får använda, ändra och dela den för **icke-kommersiella syften**. Licensen tillåter uttryckligen användning hos skolor, bibliotek, ideella organisationer och myndigheter, oavsett hur de finansieras. Den tillåter inte att någon säljer appen eller bygger in den i en betald produkt. Vill någon använda den kommersiellt kan upphovspersonen ge ett separat tillstånd.
- **Ingående delar** har egna, tillåtande licenser: idb (ISC), jsQR (Apache-2.0), qrcode-generator (MIT) och typsnitten Fredoka och Nunito (SIL Open Font License). Licenstexterna följer med appen i `THIRD-PARTY-LICENSES.txt`, som skapas med `npm run licenses`.
- Appen levereras utan garantier, enligt licensens avsnitt ”No Liability”.

Observera att en licens med förbud mot kommersiell användning inte räknas som öppen källkod enligt OSI:s definition, även om koden är öppen att läsa, ändra och dela.
