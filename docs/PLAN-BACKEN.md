# Plan: Bäcken

Steg 3 i [överlämningen](OVERLAMNING-MATTEDALEN.md#ordning). Planen är godkänd
med sju justeringar från upphovspersonen (oktober 2026), som är inarbetade nedan
och markerade med **(J1–J7)**.

## Mål och avgränsning

Bäcken tränar **addition och subtraktion inom 20** som faktafamiljer, på en
linjär, numrerad tallinje (stenarna över bäcken) och med likhetstecknet i
varierade format från första veckan. Här byggs grafen över kunskapskomponenter.

**Inom 100 byggs efter de analoga spelen och piloten.** Piloten mäter
tiotalsövergångar inom 20, och inom 100 är mest strategier som behöver andra
generatorer.

## Pedagogisk design

### Faktafamiljer

Varje uträkning är en egen fakta, som 3×7 och 7×3 i Trädgården. Familjen
{5, 8, 13} är 5 + 8, 8 + 5, 13 − 5 och 13 − 8, kopplade med ett familje-id.
Med termer 0–10 blir det 121 additioner och 121 subtraktioner.

### Kunskapskomponenter och graf (utkast)

| Del | Exempel | Kräver |
|---|---|---|
| Ett mer, ett mindre | 6 + 1, 9 − 1 | – |
| Noll | 7 + 0, 7 − 7 | – |
| Små summor | 2 + 3, 5 − 2 | ett mer |
| Tiokamrater | 7 + 3, 10 − 7 | små summor |
| Dubblor och hälften | 6 + 6, 12 − 6 | små summor |
| Inom 10, resten | 4 + 5, 9 − 4 | tiokamrater |
| Tio och några | 10 + 4, 14 − 10 | ett mer |
| Nära dubblor | 6 + 7, 13 − 7 | dubblor |
| Över tiotalet | 8 + 5, 13 − 5, 9 + 6 | tiokamrater, tio och några |
| Likhetstecknet (förståelse) | 7 + 5 = __ + 8 | tiokamrater |

En del öppnar när cirka 80 % av alla dess förkunskaper sitter. Uteslutna fakta
(pilotens otränade halva) räknas inte i nämnaren **(J6)**.

### Snabb väg förbi det barnet kan (J4)

242 fakta är mycket med några minuter om dagen. Startkollen ska därför snabbt
kunna markera noll, ett mer, tio och några och små summor som kända, så att
barnet når tiokamrater och övergångarna inom de första veckorna. Noll avgörs i
startkollen med några få frågor.

### Likhetstecknet från första veckan

Samma fakta frågas i olika format:

- vanligt `7 + 5 = __` (cirka 60 %)
- omvänt `__ = 7 + 5` (cirka 25 %)
- saknad term `7 + __ = 12` (cirka 15 %), som räknas som subtraktionen 12 − 7

En helt ny fakta visas i vanligt format de första gångerna, innan det omvända och
saknad term blandas in.

**Vågen** är en egen del med uppgifter som skapas av fakta barnet redan kan:
`7 + 5 = __ + 8`, `3 + 4 = 4 + 3` (stämmer det?), `6 = 6` och `8 = __`. Typiska
felsvar: 12 (räknar ut vänstra sidan) och 20 (lägger ihop allt). Vågen bedöms på
rätt svar på olika dagar och i olika format, inte på tid.

### Felsvar kopplade till missuppfattningar

±1 (räknar startstenen), fel räknesätt, omkastade siffror (12/21), fel vid
övergången (8 + 5 = 12), mindre från större siffra (13 − 5 = 12) och barnets
egna tidigare felsvar.

### Representationer som tonas ut

- **Tallinjen:** numrerade, lika stora stenar på rak linje. Djuret hoppar. På
  små skärmar visas ett fönster (till exempel 5–15) runt uppgiften **(J7)**.
- **Uppläsning av landningspunkter, inte varje sten (J2):** vid 8 + 5 hörs
  ”8 … 10 … 13”. Sten för sten bara på den lägsta nivån.
- **Tiotalsramen** (två rader om fem) för tiokamrater och dubblor.
- Uttoning: bild med hopp när faktan presenteras, bilden kvar under första
  inlärningssteget, sedan bara siffror. Hjälpkortet efter ett fel visar bilden.

### Räknestigar (J3)

Barnet ska kunna välja strategi efter uppgift. Samma tallinje fungerar åt båda
hållen.

- över tiotalet: 8 + 2 = 10 → 10 + 3 = 13
- nära dubblor: 6 + 6 = 12 → 12 + 1
- nio plus: 10 + 6 = 16 → 16 − 1
- subtraktion, ner till tio: 13 − 3 = 10 → 10 − 2 = 8
- subtraktion, räkna upp när talen ligger nära varandra: 13 − 11 → 11 … 13 är 2
- subtraktion, tänk addition: 5 + __ = 13

Svaret på stigen räknas inte som bevis.

### Takt, svarstid och bemästring

- Takten styrs som i dag mot 80–90 % rätt.
- **Svarstid till första siffran (J5)** vid tvåsiffriga svar, så att 13 inte
  straffas jämfört med 8. Gränserna för flytande och automatiserad sätts per
  paket och ställs in med simulering och pilot.
- **Bäckens koll:** separata kontrolluppgifter utan anpassning, ungefär var
  sjunde speldag. Kollen innehåller också vågens format, som är pilotens mått på
  transfer. Resultaten visas bara i föräldravyn.

### Uppläsning som stannar på enheten (J1)

Ingen taligenkänning. Uppläsningen använder bara röster som finns på enheten
(`voice.localService`). Chromes nätverksröster skickar texten till en server.
Finns ingen lokal svensk röst läses ingenting upp, och föräldravyn säger det.
På sikt spelas talen 0–20 och de vanligaste fraserna in som ljudfiler: samma röst
överallt, fungerar offline. Inspelningarna behöver en riktig röst och görs av
upphovspersonen.

## Världen

- **Bäcken** ritas vid bäcken, till vänster om Trädgården. Kunskapen syns som
  en **bro** med en brosten per del som sitter. Brostenar och tallinjens
  numrerade stenar ser olika ut: tallinjen är ett verktyg, bron är kunskap
  **(J7)**.
- **Läget i ord:** ”Nya stenar väntar” (nytt barn), ”Bäcken har något att visa
  dig” (något att öva) och ”Bäcken vilar” (passet gjort).
- **Dagens pass:** högst två platser. Tiden delas efter hur mycket som är
  förfallet till repetition på varje plats, inte rakt hälften. Barnet väljer
  ordning.
- **Trädgården för nya barn** öppnar när barnet har framsteg där, när dubblor
  och övergången över tiotalet sitter, eller när en vuxen öppnar den. Barn från
  Gångerträdgården har den redan öppen.

## Teknisk design

- **Struktur:** `src/shell` (profiler, dalen, föräldravyn, PWA) och
  `src/places/<plats>`. Varje plats implementerar `Place`: id och namn,
  innehållspaket, skärm, teckning och läge på kartan, del i föräldravyn och
  adapter för frågor.
- **Motorn:** upplåsning över en graf (`after`), `Unit.kind` fakta eller
  förståelse, varianter per fakta (`present`) med `variant` i `Attempt` och om
  varianten räknas som bevis, konfiguration per paket och uteslutna fakta.
- **Innehållspaketet** `src/content/addition`.
- **Skärmar:** sessionsskärmen delas i en gemensam ram och platsens adapter. Nya
  komponenter: tallinjen, tiotalsramen, vågen och bron.
- **Lagring och flytt:** säkerhetskopian tar med alla platser. QR-koden får
  formatet `MD1:` med ett block per paket och version, `GT1:` läses som förut.
  Blir koden för stor delas den per plats.
- **Föräldravyn:** värmekarta över additionstabellen 0–10, subtraktion per del,
  svåra just nu, vågens format och kollens resultat.
- **Simulering:** den simulerade eleven utökas med räkning steg för steg.

## Fynd från fas B

Simuleringen ([BACKEN.md](BACKEN.md#simulering)) visar att startkollen tar
barnet till övergångarna två till tre veckor tidigare (J4). Den visar också att
en svag elev ligger under målbandet (76 % rätt), främst på grund av
repetitionerna av övergången över tiotalet. Det följs upp i fas C (tallinjen kvar
längre för svåra fakta, fler räknestigar) och i piloten.

## Faser

| Fas | Innehåll |
|---|---|
| A. Grund **(klar)** | Skal och platser, `Place`, motorns graf, varianter, konfiguration per paket och uteslutna fakta, uppdelad sessionsskärm och bara lokala röster. Inget ändras för barnen. |
| B. Innehåll inom 20 **(klar, se [BACKEN.md](BACKEN.md))** | Fakta, graf, varianter, distraktorer, räknestigar, vågen och simulering, utan gränssnitt. |
| C. Bäcken som plats | Pass med tallinjen och uttoning, svarstid till första siffran, vågen, hjälpkort, räknestigar, uppläsning av landningspunkter, Bäcken och bron på kartan. |
| D. Skalet för flera platser | Dagens pass efter förfallna repetitioner, Trädgårdens öppning, startkoll för Bäcken, föräldravyns del, QR `MD1:`. |
| E. Bäckens koll | Kontrolluppgifter med vågens format, resultat i föräldravyn. |
| F. Inom 100 | Efter piloten. |
