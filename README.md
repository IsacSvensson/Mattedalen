# Mattedalen

Ideell matteplattform för barn 7–9 år. Korta dagliga pass i en tecknad dal där det
barnet kan växer och byggs. Forskningsbaserad repetition, inga poäng eller
topplistor. Fungerar offline, ingen data lämnar enheten. Fri för icke-kommersiellt
bruk.

> **Spela:** https://isacsvensson.github.io/Mattedalen/
>
> **Status:** Dalens karta är startsidan och har tre platser: Bäcken (addition
> och subtraktion inom 20), där ett nytt barn börjar, Trädgården
> (multiplikation och delat med), som öppnar när dubblorna sitter, och Stigen
> (talen till 100), som öppnar när barnet kan gå över tiotalet vid bäcken.
> Delat med växer som blommor och frukt på plantorna, och på Stigen tänds en
> lykta för varje del. Trädgårdens tabeller väntar högst 14 speldagar på sin del på
> Stigen. Dagens tid delas mellan högst två platser efter vad som väntar på
> repetition, och varje plats har en koll som ungefär var sjunde speldag mäter
> vad barnet kan utan stöd. Mattedalen bygger vidare på Gångerträdgården ([IsacSvensson/Multiplikation](https://github.com/IsacSvensson/Multiplikation))
> med hela dess historik. Härnäst kommer piloten, se
> [FARDPLAN.md](docs/FARDPLAN.md).

Mer att läsa:

- [docs/OVERLAMNING-MATTEDALEN.md](docs/OVERLAMNING-MATTEDALEN.md): beslut,
  pedagogiska regler, fällor och ordningen för arbetet.
- [docs/MOTORN.md](docs/MOTORN.md): faktamotorn (pass, takt, repetition,
  räknestigar, startkoll) och de simulerade eleverna.
- [docs/TRADGARDEN.md](docs/TRADGARDEN.md): Trädgården, multiplikationspaketet
  med delat med och dess spel.
- [docs/PLAN-BACKEN.md](docs/PLAN-BACKEN.md) och [docs/BACKEN.md](docs/BACKEN.md):
  Bäcken, addition och subtraktion inom 20: innehållet, platsen och planen.
- [docs/PLAN-DELAT-MED.md](docs/PLAN-DELAT-MED.md): delat med i Trädgården,
  med blommor och frukt på plantorna: beslut, design och fynd från varje fas.
- [docs/PLAN-HUNDRA.md](docs/PLAN-HUNDRA.md): förslag om talen till 100
  (Stigen) och en tydligare väg in i gånger, jämfört med hur skolan gör.
- [docs/STIGEN.md](docs/STIGEN.md): Stigen, talen till 100: delar, former,
  räknestigar, felsvar, platsen, öppningen, startkollen och kollen.
- [docs/LGR22.md](docs/LGR22.md): appens delar mot det centrala innehållet i
  matematik för årskurs 1–3.

## Vad appen tränar och inte tränar

Mattedalen är ett komplement till undervisningen, inte hela kursplanen i
matematik för årskurs 1–3.

- **Den tränar** taluppfattning och huvudräkning: addition och subtraktion
  inom 20, talen till 100 med tiotal och ental, multiplikation och division i
  tabellerna 1–10, likhetstecknet och dubbelt och hälften. Barnet lär sig fakta så
  att de sitter, och vägar från det kända till det okända (räknestigar).
- **Den tränar inte** geometri, mätning, sannolikhet och statistik,
  problemlösning, skriftliga metoder och överslagsräkning. Den ersätter inte
  samtalet om matematik, eller att räkna med konkret material tillsammans med
  någon.
- **Jämförelsen med Lgr22** står i [docs/LGR22.md](docs/LGR22.md). Den citerar
  Skolverkets kursplan ordagrant och tar med kriterierna för årskurs 3.

## Principer

Dalen visar vad barnet kan, inte vad barnet har förtjänat.

- Varje steg är en fråga barnet själv svarar på, och det som lärts in repeteras
  utspritt över dagar. En ny sak i taget bland många kända.
- Takten styrs mot hög framgångsgrad. Ingen tidspress i det vanliga passet. Det
  är ett eget försiktighetsval, och rekordjakt mot sig själv finns som frivilligt
  läge.
- Inga streaks, ingen valuta, inga kosmetiska upplåsningar och inga topplistor.
  Innehåll öppnas när förkunskaperna finns, aldrig som belöning.
- Inga siffror om framsteg på barnens sidor. Bron, lyktorna och lådan visar vad
  som sitter, och en rad säger vad barnet är på nu (”Nu: Över tiotalet”).
  Antal och andelar står i föräldravyn.
- Det som behöver repeteras ser törstigt ut. Inget vissnar och inget försvinner.
- Färg är aldrig den enda signalen, allt kan läsas upp och knapparna är stora.
- Barnet väljer vägen, systemet väljer innehållet.

**Världens bildspråk.** Tre begrepp har var sitt uttryck som aldrig blandas:
tillgänglighet (marken eller platsen), kunskap (det som växer eller fylls) och
hela områden (kanten och landskapet). Stilen är en varm bilderbok: en kontur på
2 px (`--outline`) runt allt, tunnare linjer inuti teckningarna, skuggor och
landskapets linjer i sina egna toner i stället för svart. Bara det man kan trycka
på har en tryckkant, i en mörkare ton av knappen själv. Tangenterna är trä (och
stenar vid Bäcken), skyltarna trätavlor och korten papper. Tre hörnradier, en
orange huvudknapp per skärm, Fredoka för rubriker och siffror och Nunito för
text. All grafik är ritad SVG och typsnitten följer med appen. Reglerna står överst i
`src/shell/styles.css`, och hur de används i trädgården beskrivs i
[TRADGARDEN.md](docs/TRADGARDEN.md#designregler).

## Dalen (`src/shell/screens/valley.ts`)

Dalen är barnets startsida. Barnet väljer sig själv under ”Vem spelar?” och
kommer då till dalen. Dalen är en karta som fyller skärmen, med varje plats i
full storlek (`src/shell/components/valleyMap.ts`, lägena i
`src/shell/valleyLayout.ts`, se [PLAN-DALEN.md](docs/PLAN-DALEN.md)).

- **Bara platser som finns står på kartan.** Det finns inga stängda platser som
  väntar på att låsas upp, för innehåll öppnas när det finns och när barnet har
  förkunskaperna, aldrig som belöning. En plats som inte är öppen än vilar på
  kartan, med raden om när den öppnar.
- **Kartan visar platserna som de är:** valvbron över bäcken, stolparna med
  lyktorna och hela odlingslådan. Bilderna kommer från platsernas egna sidor
  (`Place.scene`). Vid varje plats står skylten, dagens läge och raden ”Nu: …”.
  Solrosorna på kullen är samma som i trädgården: en per tabell barnet kan.
- **Telefon:** kartan är större än skärmen, och barnet drar runt i den åt alla
  håll. Musen drar på samma sätt, och piltangenterna flyttar kartan. Två fingrar
  zoomar ut till hela dalen och in igen, aldrig närmare än full storlek, och
  knappen nere till höger gör samma sak (”Visa hela dalen”, ”Gå närmare”). Långt
  ute behåller skyltarna en läsbar storlek.
  Pilar i kanten pekar mot platser utanför skärmen (”↑ Bäcken”), och ett tryck
  glider dit. Pilarna skjuts isär, så att de aldrig ligger på varandra eller på
  rubriken. Sidan rullar aldrig: kartan panoreras i sin egen behållare.
- **Breda skärmar** visar hela dalen på en gång, skalad så att den får plats.
  Det gäller när kartan får plats i minst 70 % av sin storlek, som på en
  surfplatta eller dator.
- **Dagens läge står i text och bild**, aldrig bara i färg. Platsen kan vänta på
  sina första frön, vara törstig när dagens pass inte är gjort, eller sova när
  passet är klart. Inget vissnar, och inga dagar räknas.
- **Uppläsning.** Har barnet uppläsning påslagen finns en knapp som läser upp
  platsernas lägen.
- **Bakåtknappen** (telefonens eller webbläsarens) går ett steg tillbaka i
  stället för att stänga appen: den trycker på skärmens egen väg tillbaka, som
  hemknappen i ett pass eller djuret som går till dalen (`backTarget` i
  `src/shell/app.ts`). Först på ”Vem spelar?” stängs appen.
- **Navigering.** Kartan öppnar vid dagens plats: den plats som inte vilar och
  har mest att repetera i dag, vid lika den första. Där står barnets djur.
  Skylten och bilden leder till platsen. Djuret i platsens sidhuvud leder
  tillbaka till dalen (”Till dalen”), och då står kartan vid den platsen.
  Spelare byts med djuret uppe till vänster i dalen. En ny spelare börjar vid
  bäcken, där startkollen erbjuds.
- **I dag** (`src/shell/components/today.ts`). Uppe till höger finns en sol med
  en liten prick när något återstår i dag, aldrig en siffra. Ett tryck öppnar
  ett litet kort med det som återstår, dagens plats först: ”Hoppa på stenarna”,
  ”Gå på stigen”, ”Vattna trädgården”. En rad startar passet direkt
  (`Place.start`), med startkollen första gången och kollen först när den är
  dags. Platser som vilar står längst ner. När allt är gjort finns ingen sol.
- **Dagens plan** (`src/shell/dayPlan.ts`). Passlängden i föräldravyn är hela
  dagens tid. Barnet besöker högst två platser om dagen och väljer själv
  ordningen. Varje plats får först 5 minuter, och resten delas efter hur mycket
  som är förfallet till repetition där, inte rakt hälften. Planen görs vid
  dagens första besök i dalen och står kvar hela dagen, så att andelarna inte
  flyttar sig medan barnet arbetar. En öppen plats utanför dagens två vilar.
- **Trädgårdens öppning** (`src/places/tradgarden/opening.ts`). Gånger börjar
  med dubblorna (×2 är att dubbla), så Trädgården öppnar när dubblorna sitter vid
  bäcken, när barnet redan har framsteg i trädgården eller när en vuxen öppnar den
  i föräldravyn. Barn från Gångerträdgården har den öppen. Innan dess vilar den
  på kartan med texten ”Trädgården öppnar när du kan dubblorna vid
  bäcken.” Trädgårdens startkoll erbjuds första
  gången barnet kommer dit.

Dalen testas i `e2e/valley.spec.ts` och i testerna för smala telefoner och
liggande telefon. Trädgårdens läge testas i `tests/game/valley.test.ts`.

## Arkitektur

```
src/
  engine/                   innehållsneutral faktamotor (ren logik), se docs/MOTORN.md
  content/multiplication/   Trädgårdens innehållspaket: gånger och delat med, Dela lika, former, räknestigar, koll
  content/addition/         Bäckens innehållspaket: faktafamiljer, graf, format, Vågen, räknestigar
  content/hundred/          Stigens innehållspaket (talen till 100): delar, former, räknestigar, felsvar
  storage/                  ProgressStore, IndexedDB, säkerhetskopior, import från Gångerträdgården
  sw/                       service workerns mall
  shell/                    skalet, gemensamt för alla platser (vanilla TS + liten h()-hjälpare)
    place.ts                gränssnittet Place som varje plats implementerar
    screens/valley.ts       dalen: startsidan med kartan
    components/valleyMap.ts kartan: platserna, bäcken, att dra runt och zooma, pilarna i kanten
    valleyLayout.ts         var platserna, bäcken och stigen står på kartan
    screens/session.ts      ramen för ett pass (frågor, svar, uppläsning, räknestig, hjälpkort)
    screens/parent/         För vuxna: översikten och sidorna (plats, inställningar, enheten, hämta)
  places/
    tradgarden/             Trädgården: platsen, dess skärmar och dess del av föräldravyn
    backen/                 Bäcken: bron, tallinjen, tiotalsramen, vågen, skärmarna och föräldradelen
    stigen/                 Stigen (talen till 100): stolpar och lyktor, stavar och kuber, tom tallinje, hundraplatta, startkoll och koll
tests/
  engine/                   enhetstester för motorn (med ett glosor-paket)
  content/                  tester för innehållspaketen
  simulation/               simulerade elever: varje plats för sig, och hela dalen i ett år
  storage/                  kontraktstester för minne och IndexedDB, importen
  game/                     spelets och dalens logik (utan DOM)
e2e/                        Playwright: hela flöden i riktig webbläsare
```

Spelet är skrivet i vanilla TypeScript med en liten `h()`-hjälpare (`dom.ts`).
Skalet (profiler, dalen, föräldravyn, passets ram, lagring och PWA) är gemensamt
för alla platser och beror inte på någon av dem. Bara `main.ts` vet vilka platser
som finns.

En plats implementerar `Place` (`src/shell/place.ts`): namn, innehållspaket, sin
skärm, hur den ser ut på kartan (det som växer, dagens läge, solrosor på kullen),
vad ett nytt barn möter först och sin del av föräldravyn. I ett pass bidrar
platsen med hur en ny fakta presenteras, räknestigen och bilden i hjälpkortet
(`SessionPlace`); resten är skalets ram.

Motorn förstår en graf av kunskapskomponenter (`unlockRule: 'after'`), olika
format för samma fakta (`present`), inställningar per innehållspaket och fakta
som hålls utanför övningen (pilotens otränade halva). Se
[docs/MOTORN.md](docs/MOTORN.md#graf-format-och-uteslutna-fakta).

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

## Lagring (`src/storage`)

Spelet pratar bara med gränssnittet `ProgressStore`, så lagringen kan bytas mot en
backend senare utan att motorn eller spelet ändras. Gränssnittet har:

- profiler
- framsteg per profil och innehållspaket (`load`, `save`)
- svarslogg (`appendAttempt`)
- pass
- säkerhetskopior (`export`, `import`)
- små appinställningar, till exempel föräldra-PIN

Det finns två implementationer. **`IndexedDbProgressStore`** bygger på `idb` och
sparar i databasen `mattedalen` (`DB_NAME`).
**`MemoryProgressStore`** används i tester och som reserv när IndexedDB är
blockerat, till exempel i vissa privata lägen. Båda körs mot samma kontraktstester.

| Objektlager | Nyckel | Innehåll |
|---|---|---|
| `profiles` | `id` | namn, avatar, inställningar (passlängd, mer tid, uppläsning, fritt svar) |
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
  `unsupported`) visas i föräldravyn.
- **Säkerhetskopia (JSON).** `export` ger en fullständig kopia av en profil,
  inklusive loggen. `import` validerar och reparerar trasiga poster och skriver
  allt i en enda transaktion. Om profilen redan finns importeras den som en kopia,
  om man inte väljer `onConflict: 'replace'`.

## Flytt från Gångerträdgården

Gångerträdgården och Mattedalen ligger på samma ursprung
(`https://isacsvensson.github.io/`), och där delar alla appar på IndexedDB och
cachar. Därför gäller:

- **Egen databas.** Mattedalen sparar i databasen `mattedalen`. Gångerträdgården
  använder `gangertradgarden`.
- **Automatisk import vid första start** (`src/storage/legacy.ts`). Finns
  Gångerträdgårdens databas och har Mattedalen inga barn än, kopieras alla barn
  med framsteg, pass och logg, vuxenkoden, senast valda barn och valet att dölja
  installationsbanderollen. Den gamla databasen öppnas bara för läsning och
  lämnas orörd, så Gångerträdgården fungerar som förut. Importen görs en gång.
  En markering skrivs innan barnen kopieras och avslutas efteråt, så en avbruten
  import görs klart vid nästa start. Ett barn vars data inte går att läsa hoppas
  över, och resten följer med. Finns ingen gammal databas skapas ingen heller.
- **Egen cache.** Service workern använder prefixet `mattedalen-` och rensar bara
  sina egna cachar. Gångerträdgården raderar alla cachar som heter
  `gangertradgarden-*` utom sin egen, så prefixet får aldrig vara detsamma.
- **Säkerhetskopior.** Nya kopior har formatet `mattedalen-profil`. Kopior med det
  gamla formatet `gangertradgarden-profil` kan fortfarande läsas, och QR-koder från
  Gångerträdgården (`GT1:`) också.
- **iPhone och iPad.** En app som lagts till på hemskärmen har egen lagring, skild
  från Safari. Barn som spelat Gångerträdgården från hemskärmen följer därför inte
  med automatiskt. Flytta dem i stället med QR-kod eller säkerhetskopia från
  Gångerträdgårdens föräldravy. På Android och dator fungerar den automatiska
  importen.

Importen testas med enhetstester (`tests/storage/legacy.test.ts`) och i
webbläsaren (`e2e/legacy.spec.ts`).

## Flytta mellan enheter

- **QR-kod** (`storage/qrCodec.ts`, formatet `MD1:`). Koden innehåller namn, djur,
  passlängd, om Trädgården och Stigen är öppna, om tabellerna väntar på Stigen
  och vilken dag de kunde ha öppnat, om barnet har mer tid, och ett block per plats: innehållspaketets id
  och version och status per fakta i 3 bitar (status plus ungefärlig
  Leitner-låda). Allt skyddas med CRC-8. Datan base45-kodas, så att QR-kodens
  kompakta alfanumeriska läge kan användas. Båda platserna ryms i en QR-kod av
  högst version 10, som en telefonkamera läser lätt. Koder från
  Gångerträdgården (`GT1:`) läses som ett barn med Trädgården öppen. På mottagande enhet väljer man ”Skanna QR-kod” och
  använder kameran. Det går också att fotografera koden och välja bilden.
  Avläsningen använder `BarcodeDetector` där den finns, annars `jsqr`, som bara
  laddas när den behövs. Status, repetitionsschema och upplåsta enheter
  återskapas. Finns redan ett barn med samma namn väljer man om det ska ersättas.
- **JSON-säkerhetskopia** med allt, även hela loggen. Den sparas som fil och
  öppnas på den andra enheten. Finns profilen redan väljer man mellan ”Ersätt”
  och ”Lägg till som kopia”.
- **Fil till piloten** (`storage/pilot.ts`, [PLAN-PILOT](docs/PLAN-PILOT.md)):
  barnets svar, pass och fakta under en pilotkod, utan namn, djur och profilens
  id. Filen byggs av en lista över det som ska med. Den sparas på enheten, och
  den vuxna väljer själv om den ska skickas.

Båda vägarna testas i e2e mellan två separata webbläsarkontexter. QR-koden testas
också i enhetstester genom att den ritas till pixlar och läses av med jsQR.

## Föräldravy (`src/shell/screens/parent`)

Föräldravyn nås via ”För vuxna” på startsidan. Den skyddas av en fyrsiffrig
vuxenkod som väljs första gången. Koden är ingen säkerhetsfunktion, eftersom
datan ändå finns på enheten. Den finns bara för att barn inte ska hamna där av
misstag. Den som glömt koden besvarar en additionsfråga för vuxna och väljer
sedan en ny.

Vyn heter **För vuxna** och är uppdelad i sidor (se
[PLAN-FORALDRAVYN.md](docs/PLAN-FORALDRAVYN.md)). Telefonens bakåtknapp går ett
steg tillbaka, från en sida till översikten.

- **Översikten** visar barnen överst, sedan **Att göra för dig** när något
  väntar på en vuxen: en plats som kan öppnas tidigare, en tabell som väntar på
  stigen, ett nytt kollresultat, ett barn som svarar rätt men långsamt (”Ge mer
  tid”), ett barn som räknar plus när det står minus vid bäcken och lagring som
  webbläsaren kan radera. Det går
  inte att avfärda; en sak försvinner när den är gjord. Sedan **den här
  veckan** (övade minuter per dag under 14 dagar och hur många dagar barnet
  spelat), en rad per plats med vad barnet är på, det som är svårast och en
  stapel för hur mycket som sitter (`Place.parentSummary`), och raden **Barnets
  inställningar**. Längst ner finns **Hämta ett barn**, **Den här enheten** och
  **Tyck till**.
- **En plats** har alltid samma ordning: läget, svåra just nu (högst fem, med
  ”Visa alla”), de vanligaste förväxlingarna, platsens koll, alla fakta som
  värmekartor (ihopfällda) och sist startkollen (`Place.parentPage`).
- **Barnets inställningar** samlar allt barnet har: namn, djur, passlängd
  10–15 minuter, **Ge mer tid** (dubbel tid för buske och träd, för ett barn som
  svarar rätt men långsamt) och uppläsning, sedan platsernas egna val
  (`Place.parentSettings`): fritt svar, hur delat med skrivs och om tabellerna
  väntar på stigen. Längst ner flyttar man eller sparar barnet, eller tar bort
  profilen.
- **Den här enheten**: lagring, version och uppdatering, hemskärmen, integritet
  och vuxenkoden.
- **Hämta ett barn**: QR-kod, säkerhetskopia och Gångerträdgården.
- **Tyck till**: en knapp som öppnar ett mejl till matematikdalen@gmail.com i
  den vuxnas eget mejlprogram, med några frågor och appens version. Appen spårar
  ingenting, så det de vuxna berättar är det enda projektet får veta. Under den
  finns länkar till GitHub: skapa ett ärende, eller läs hur man bidrar
  ([Bidra](#bidra)).

På **Trädgårdens** sida:

- antal fakta per status, antal fullständiga pass, senaste speldag och
  upplåsta enheter
- en **värmekarta** över 10×10-rutnätet. En tryckning på en ruta visar status,
  antal försök, andel rätt, genomsnittlig svarstid och vanligaste felsvar.
- **svåra just nu**, med samma strategi som räknestigen använder
- de **vanligaste förväxlingarna**, till exempel ”7 × 8 – svarade 48 (3 gånger)”
- att göra om startkollen
- ”Öppna Trädgården nu” för ett barn där den inte har öppnat än

På **Bäckens** sida:

- delarna med hur många plus- och minusfakta som sitter i varje del, och Vågen
  per uppgiftstyp (”Vad ska stå i rutan?” och ”Stämmer det?”)
- svåra just nu med strategin och de vanligaste förväxlingarna
- **Bäckens koll**: rätt per sort vid varje koll, med likhetstecknet i former
  barnet inte har övat (se [BACKEN.md](docs/BACKEN.md#bäckens-koll-checkts))
- en **värmekarta** över additionstabellen 0–10
- att göra om startkollen vid bäcken

Under ”Hämta ett barn” finns hjälp för den som spelat
Gångerträdgården. Där står också hur många barn som hämtades automatiskt och när.

Vyn visar också enhetens lagringsstatus: om beständig lagring är beviljad, med en
knapp för att be om den, och hur mycket utrymme som används. Där förklaras också
varför det minskar risken att data raderas om appen läggs på hemskärmen.

## PWA och offline

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
  - **Tillbaka dit man var** (`resume.ts`). Efter omladdningen för en
    uppdatering öppnar appen samma skärm för samma barn: dalen, en plats eller
    sidan i ”För vuxna”, där vuxenkoden frågas igen. Det sparas i sessionStorage
    precis före omladdningen och gäller bara inom fem minuter. En vanlig start
    börjar på ”Vem spelar?” ([PLAN-UPPDATERING](docs/PLAN-UPPDATERING.md)).
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

## Integritet

Appen sätter inga cookies och har ingen spårning, analys eller reklam. All data
(IndexedDB) och appens egna filer (Cache API) lagras bara på enheten och behövs
för att tjänsten ska fungera. Därför krävs inget samtyckesformulär enligt lagen
om elektronisk kommunikation (9 kap. 28 §). Ingen data lämnar enheten om inte
föräldern själv exporterar den, som säkerhetskopia, QR-kod eller fil till
piloten. Filen till piloten har inget namn, bara en pilotkod. Ett mejl under
”Tyck till” skickas från den vuxnas eget mejlprogram, med appens version men
inget om barnet. Föräldravyn har en kort integritetstext.
Värden, GitHub Pages, loggar IP-adresser enligt GitHubs integritetspolicy.

Uppläsningen använder bara röster som finns på enheten (`voice.localService`).
Chrome erbjuder också nätverksröster som skickar texten till en server. De
används aldrig, inte heller webbläsarens standardröst, som kan vara en sådan.
Finns ingen svensk röst på enheten läses ingenting upp, och föräldravyn säger
det. Det testas i `e2e/extras.spec.ts`. Det finns ingen taligenkänning, eftersom
den skickar ljud från enheten.

## Publicering på GitHub Pages

`.github/workflows/deploy.yml` bygger och publicerar repots **standardgren**
(`main`) vid varje push. Det kan också startas manuellt under *Actions → Publicera på GitHub
Pages → Run workflow*. Enhetstesterna körs först. Engångsinställning: välj
**Settings → Pages → Build and deployment → Source: GitHub Actions** i repot.
Appen hamnar då på `https://<användare>.github.io/<repo>/`.
`.github/workflows/ci.yml` kör typkontroll, enhetstester, bygge och
Playwright-tester vid varje push och pull request.

## Tester

- **Enhetstester** (Vitest): motorn, innehållspaketet, simulerade elever,
  lagringen (samma kontraktstester för minne och IndexedDB), importen från
  Gångerträdgården samt spelets och dalens logik.
- **E2e-tester** (Playwright) i surfplatta och telefon: hela flöden i riktig
  webbläsare. Några skydd ska alltid finnas kvar:
  - `offline.spec.ts`: appen fungerar utan nät, och inget anrop går till någon
    annan värd.
  - `narrow.spec.ts` och `landscape.spec.ts`: 320 och 360 px breda telefoner
    och liggande telefon. Sidledsrullning mäts mot den inställda bredden,
    eftersom en emulerad mobil annars vidgar fönstret i stället för att rulla.
  - `legacy.spec.ts`: importen från Gångerträdgården och att den gamla appens
    databas och cachar lämnas orörda.
  - `update.spec.ts`: nya versioner når även en installerad app.
- **Dalen med många slumpfrön** tar några minuter och körs bara för hand. Den
  skriver en rapport till `tests/simulation/out/report.md`:
  `VALLEY_REPORT=svag npx vitest run tests/simulation/valleyReport.test.ts`
  (och `genomsnittlig`, `stark`), sedan `VALLEY_REPORT=summary` med samma
  kommando.
- Typkontroll, enhetstester, bygge och e2e körs före varje push. Ett fel som
  hittas på en riktig enhet får ett eget e2e-test.

## Ordning framåt

Vad vi bygger och i vilken ordning står i [docs/FARDPLAN.md](docs/FARDPLAN.md):
det som är klart, det som kommer härnäst, öppna beslut och det som väntar till
efter piloten. Varje fas har en egen plan som länkas därifrån.

## Bidra

Alla får bidra: med kod, med kunskap om matematik och barn, eller med en rapport
om något som inte fungerar. Appen länkar hit från ”Tyck till” i ”För vuxna”.

- **Ett fel eller en idé:** skapa ett [ärende](https://github.com/IsacSvensson/Mattedalen/issues/new).
  Ärenden syns för alla, så skriv inte barnets namn. Vill du skriva privat,
  mejla matematikdalen@gmail.com.
- **Kod:** gör en fork och en gren, och skicka en pull request. Kör
  `npm run typecheck`, `npm test` och `npm run e2e` först (se
  [Kom igång](#kom-igång)). Större ändringar börjar med en plan i `docs/`, som
  de andra planerna i [FARDPLAN](docs/FARDPLAN.md).
- **Det som inte ändras:** ingen data lämnar enheten av sig själv, och appen
  har inga cookies, ingen spårning, ingen reklam och inga poäng. Beroendena hålls
  få.
- **Språk:** dokumenten skrivs på svenska med korta meningar. Koden och
  kommentarerna skrivs på engelska.
- **Licens:** ett bidrag får användas under samma licens som resten av
  projektet (se nedan).

## Licens

Mattedalen är ett ideellt projekt, fritt att använda för att barn ska lära sig matematik.

- **Koden och grafiken** omfattas av [PolyForm Noncommercial License 1.0.0](LICENSE.md). Alla får använda, ändra och dela den för **icke-kommersiella syften**. Licensen tillåter uttryckligen användning hos skolor, bibliotek, ideella organisationer och myndigheter, oavsett hur de finansieras. Den tillåter inte att någon säljer appen eller bygger in den i en betald produkt. Vill någon använda den kommersiellt kan upphovspersonen ge ett separat tillstånd.
- **Ingående delar** har egna, tillåtande licenser: idb (ISC), jsQR (Apache-2.0), qrcode-generator (MIT) och typsnitten Fredoka och Nunito (SIL Open Font License). Licenstexterna följer med appen i `THIRD-PARTY-LICENSES.txt`, som skapas med `npm run licenses`.
- Appen levereras utan garantier, enligt licensens avsnitt ”No Liability”.

Observera att en licens med förbud mot kommersiell användning inte räknas som öppen källkod enligt OSI:s definition, även om koden är öppen att läsa, ändra och dela.
