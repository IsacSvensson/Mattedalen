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
const session = engine.startSession({ states, meta });   // mode: 'daily' | 'extra'
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
All grafik är inbäddad SVG, och det finns inga externa resurser.

- **`play.ts`** (`PlayController`) kopplar ihop motorn och lagringen utan DOM.
  Efter varje svar sparas försöket och faktans tillstånd. När passet är slut sparas
  passets kvitto och elevens meta. Avbryter barnet passet tidigt finns framstegen
  kvar, men dagen räknas inte som klar. Allt detta testas med minneslagringen.
- **Profiler.** Flera barn kan använda samma enhet, och varje barn har namn och ett
  djur.
- **Kartan** är 10×10-rutnätet som trädgårdsland. Raden *a* och kolumnen *b* visar
  *a × b*, så 3×7 och 7×3 speglas över diagonalen. Varje ruta visar faktans
  status: jord → frö → planta → buske → träd. Fakta som just har vuxit animeras.
- **Introduktion av nya fakta.** Barnet drar ut rektangeln på en bräda med
  10 × 10 prickar och ser storleken medan det drar, till exempel ”3 × 6”. En
  speglad rektangel kan vridas 90° med ”Vrid 🔄”. Kan barnet redan tvillingen
  (7 × 3) börjar brädet från den, och barnet vrider den till 3 × 7. ”Visa mig”
  bygger rektangeln åt barnet. När den är rätt visas strategin som färgade delar,
  till exempel 8 × 7 som två 4 × 7-halvor eller 9 × 6 som 10 × 6 där sista raden
  är struken. Sedan svarar barnet själv (”Nu du!”).
- **Svarsformat.** Fakta under inlärning frågas med flerval: fyra stora knappar,
  och tangenterna 1–4 fungerar. Flytande fakta frågas med fritt svar på en stor
  sifferknappsats (siffror, ⌫ och ✓, eller tangentbordet). Fritt svar krävs för
  statusen ”automatiserad”. Svarstiden mäts men visas aldrig, och ingen klocka
  syns.
- **Återkoppling.** Vid rätt svar kommer en kort glädjeanimation. Vid fel ersätts
  svarsytan av ett hjälpkort med rätt svar, strategin och den färgade rektangeln,
  aldrig bara ”fel”. Är felsvaret en typisk förväxling får barnet en vänlig
  förklaring (”48 är 8 × 6 – nära!”, ”7 är 3 + 4. Här ska det vara 3 gånger 4.”).
  Felsvaret loggas som förväxling.
- **Avslutningen.** När tiden är slut (12 minuter som standard) får barnet svara
  klart på frågan och ser sedan ”Trädgården behöver sova nu” med vad som växte.
  Under resten av dagen sover trädgården. Extra övning är frivillig, märkt som
  frivillig, varar 5 minuter och ger inga nya fakta.

### Föräldravy (`src/game/screens/parent`)

Föräldravyn nås via ”🔒 För vuxna” på startsidan. Den skyddas av en fyrsiffrig
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

- **⚡ Slå ditt rekord** (`screens/challenge.ts`). Barnet har 90 sekunder och
  får bara fakta som redan är minst ”flytande”. Läget öppnas när 5 fakta är
  buskar. Här, och bara här, syns en tidsstapel. Ett fel svar ger inget straff:
  rätt svar visas en kort stund och spelet fortsätter. Poängen jämförs bara med
  barnets eget bästa resultat (”Nytt rekord!”), aldrig med andra barn.
- **🃏 Gångerkrig – barn mot vuxen** (`screens/duel.ts`). Två spelare på samma
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
Spelen sparas som pass med `mode: 'challenge'` respektive `'duel'`.

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
- **Uppdateringar.** En ny version installeras i bakgrunden och väntar.
  Startsidan visar då ”🔄 Ny version finns – uppdatera”. Appen byts aldrig ut
  mitt i ett pass.
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
