# Mattedalen

Ideell matteplattform för barn 7–9 år. Korta dagliga pass i en tecknad dal där det
barnet kan växer och byggs. Forskningsbaserad repetition, inga poäng eller
topplistor. Fungerar offline, ingen data lämnar enheten. Fri för icke-kommersiellt
bruk.

> **Spela:** https://isacsvensson.github.io/Mattedalen/
>
> **Status:** Skalet är klart: dalens karta är startsidan, och Trädgården
> (multiplikation) är den första platsen. Mattedalen bygger vidare på
> Gångerträdgården ([IsacSvensson/Multiplikation](https://github.com/IsacSvensson/Multiplikation))
> med hela dess historik. Härnäst kommer Bäcken (addition och subtraktion), se
> [Ordning framåt](#ordning-framåt).

Mer att läsa:

- [docs/OVERLAMNING-MATTEDALEN.md](docs/OVERLAMNING-MATTEDALEN.md): beslut,
  pedagogiska regler, fällor och ordningen för arbetet.
- [docs/MOTORN.md](docs/MOTORN.md): faktamotorn (pass, takt, repetition,
  räknestigar, startkoll) och de simulerade eleverna.
- [docs/TRADGARDEN.md](docs/TRADGARDEN.md): Trädgården, multiplikationspaketet
  och dess spel.

## Principer

Dalen visar vad barnet kan, inte vad barnet har förtjänat.

- Varje steg är en fråga barnet själv svarar på, och det som lärts in repeteras
  utspritt över dagar. En ny sak i taget bland många kända.
- Takten styrs mot hög framgångsgrad. Ingen tidspress i det vanliga passet. Det
  är ett eget försiktighetsval, och rekordjakt mot sig själv finns som frivilligt
  läge.
- Inga streaks, ingen valuta, inga kosmetiska upplåsningar och inga topplistor.
  Innehåll öppnas när förkunskaperna finns, aldrig som belöning.
- Det som behöver repeteras ser törstigt ut. Inget vissnar och inget försvinner.
- Färg är aldrig den enda signalen, allt kan läsas upp och knapparna är stora.
- Barnet väljer vägen, systemet väljer innehållet.

**Världens bildspråk.** Tre begrepp har var sitt uttryck som aldrig blandas:
tillgänglighet (marken eller platsen), kunskap (det som växer eller fylls) och
hela områden (kanten och landskapet). Samma kontur (`--outline`) överallt,
tryckskugga (`--press`) bara på det man kan trycka på, tre hörnradier, en orange
huvudknapp per skärm, Fredoka för rubriker och siffror och Nunito för text. All
grafik är ritad SVG och typsnitten följer med appen. Reglerna står överst i
`src/shell/styles.css`, och hur de används i trädgården beskrivs i
[TRADGARDEN.md](docs/TRADGARDEN.md#designregler).

## Dalen (`src/shell/screens/valley.ts`)

Dalen är barnets startsida. Barnet väljer sig själv under ”Vem spelar?” och
kommer då till dalens karta. Därifrån går barnet till platserna.

- **Bara platser som finns ritas.** Trädgården är den enda platsen än så länge.
  Resten av dalen är landskap med en bäck och en stig. Det finns inga stängda
  platser som väntar på att låsas upp, för innehåll öppnas när det finns och när
  barnet har förkunskaperna, aldrig som belöning.
- **Kartan visar vad barnet kan.** Trädgården ritas som en liten odlingslåda med
  barnets mest utvecklade plantor (`miniBed` i `src/places/tradgarden/valley.ts`). Solrosorna
  på kullen är samma som i trädgården: en per tabell barnet kan.
- **Dagens läge står i text och bild**, aldrig bara i färg. Platsen kan vänta på
  sina första frön, vara törstig när dagens pass inte är gjort, eller sova när
  passet är klart. Inget vissnar, och inga dagar räknas.
- **Uppläsning.** Har barnet uppläsning påslagen finns en knapp som läser upp
  platsens namn och läge.
- **Navigering.** Platsen och den orangea knappen ”Gå till trädgården” leder
  båda till trädgården. Djuret i trädgårdens sidhuvud leder tillbaka till dalen
  (”Till dalen”), och spelare byts i dalen. En ny spelare går som förut direkt
  från startkollen in i trädgården. Inget annat i trädgården har ändrats.

Dalen testas i `e2e/valley.spec.ts` och i testerna för smala telefoner och
liggande telefon. Logiken utan DOM testas i `tests/game/valley.test.ts`.

## Arkitektur

```
src/
  engine/                   innehållsneutral faktamotor (ren logik), se docs/MOTORN.md
  content/multiplication/   Trädgårdens innehållspaket: fakta, enheter, strategier, distraktorer
  storage/                  ProgressStore, IndexedDB, säkerhetskopior, import från Gångerträdgården
  sw/                       service workerns mall
  shell/                    skalet, gemensamt för alla platser (vanilla TS + liten h()-hjälpare)
    place.ts                gränssnittet Place som varje plats implementerar
    screens/valley.ts       dalen: startsidan med kartan
    screens/session.ts      ramen för ett pass (frågor, svar, uppläsning, räknestig, hjälpkort)
    screens/parent/         föräldravyn, med en del per plats
  places/
    tradgarden/             Trädgården: platsen, dess skärmar och dess del av föräldravyn
tests/
  engine/                   enhetstester för motorn (med ett glosor-paket)
  content/                  tester för multiplikationspaketet
  simulation/               simulerade elever över 26 veckor
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

## Föräldravy (`src/shell/screens/parent`)

Föräldravyn nås via ”För vuxna” på startsidan. Den skyddas av en fyrsiffrig
vuxenkod som väljs första gången. Koden är ingen säkerhetsfunktion, eftersom
datan ändå finns på enheten. Den finns bara för att barn inte ska hamna där av
misstag. Den som glömt koden besvarar en additionsfråga för vuxna och väljer
sedan en ny.

För varje barn visar vyn först det som gäller alla platser:

- **övade minuter per dag** under de senaste 14 dagarna
- inställningar: namn, djur, passlängd 10–15 minuter och uppläsning
- att flytta barnet till en annan enhet, eller ta bort profilen

Sedan kommer en del per plats. För **Trädgården**:

- antal fakta per status, antal fullständiga pass, senaste speldag och
  upplåsta enheter
- en **värmekarta** över 10×10-rutnätet. En tryckning på en ruta visar status,
  antal försök, andel rätt, genomsnittlig svarstid och vanligaste felsvar.
- **svåra just nu**, med samma strategi som räknestigen använder
- de **vanligaste förväxlingarna**, till exempel ”7 × 8 – svarade 48 (3 gånger)”
- fritt svar av eller på, och att göra om startkollen

Under ”Hämta ett barn från en annan enhet” finns hjälp för den som spelat
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
föräldern själv exporterar den. Föräldravyn har en kort integritetstext.
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
- Typkontroll, enhetstester, bygge och e2e körs före varje push. Ett fel som
  hittas på en riktig enhet får ett eget e2e-test.

## Ordning framåt

Enligt [överlämningen](docs/OVERLAMNING-MATTEDALEN.md#ordning):

1. ~~Nytt repo med Gångerträdgårdens historik, egen databas och import.~~
2. ~~Skalet med dalens karta och Trädgården som första plats.~~
3. **Bäcken:** addition och subtraktion inom 20 och sedan 100 som faktafamiljer,
   en linjär numrerad tallinje, tiokamrater, dubblor, övergång via tiotalet och
   likhetstecknet i varierade format från första veckan. Här byggs grafen över
   kunskapskomponenter.
4. **Analoga spel:** ett utskrivbart brädspel och kortlekar, och ett ”spela med
   en vuxen”-kort i veckan.
5. **Pilot** med 6–10 barn.
6. **Dammen** (taluppfattning) och **Bikupan** (positionssystemet).

## Licens

Mattedalen är ett ideellt projekt, fritt att använda för att barn ska lära sig matematik.

- **Koden och grafiken** omfattas av [PolyForm Noncommercial License 1.0.0](LICENSE.md). Alla får använda, ändra och dela den för **icke-kommersiella syften**. Licensen tillåter uttryckligen användning hos skolor, bibliotek, ideella organisationer och myndigheter, oavsett hur de finansieras. Den tillåter inte att någon säljer appen eller bygger in den i en betald produkt. Vill någon använda den kommersiellt kan upphovspersonen ge ett separat tillstånd.
- **Ingående delar** har egna, tillåtande licenser: idb (ISC), jsQR (Apache-2.0), qrcode-generator (MIT) och typsnitten Fredoka och Nunito (SIL Open Font License). Licenstexterna följer med appen i `THIRD-PARTY-LICENSES.txt`, som skapas med `npm run licenses`.
- Appen levereras utan garantier, enligt licensens avsnitt ”No Liability”.

Observera att en licens med förbud mot kommersiell användning inte räknas som öppen källkod enligt OSI:s definition, även om koden är öppen att läsa, ändra och dela.
