# Bäcken

Bäcken är dalens andra plats: addition och subtraktion inom 20 som faktafamiljer,
på en linjär, numrerad tallinje, och likhetstecknet i varierade format från
första veckan. Planen och upphovspersonens justeringar finns i
[PLAN-BACKEN.md](PLAN-BACKEN.md). Innehållet (`src/content/addition`) byggdes
i fas B och platsen (`src/places/backen`) i fas C.

## Fakta och familjer

Termerna går från 0 till 10, så summorna når upp till 20. Varje uträkning är en
egen fakta (`8+5`, `13-5`): 121 additioner och 121 subtraktioner, alltså 242
fakta. Familjen {5, 8, 13} består av 5 + 8, 8 + 5, 13 − 5 och 13 − 8. Hela
familjen ligger i samma del. Varje fakta har en tvilling åt andra hållet:
8 + 5 och 5 + 8, och 13 − 5 och 13 − 8.

## Delar och graf

| Ordning | Del | Antal | Kräver |
|---|---|---|---|
| 1 | Ett mer, ett mindre | 38 | – |
| 2 | Noll | 42 | – |
| 3 | Små summor | 4 | ett mer |
| 4 | Tio och några | 34 | ett mer |
| 5 | Tiokamrater | 12 | små summor |
| 6 | Dubblor och hälften | 16 | små summor |
| 7 | Inom 10 | 24 | tiokamrater |
| 8 | Nära dubblor | 24 | dubblor |
| 9 | Likhetstecknet (Vågen, förståelse) | 24 | tiokamrater |
| 10 | Över tiotalet | 48 | tiokamrater, tio och några |

En del öppnas när cirka 80 % av varje förkunskap är flytande. Nya fakta kommer
del för del i den här ordningen bland de delar som är öppna. Vågen står före Över
tiotalet så att likhetstecknet i nya former kommer tidigt och inte först efter
alla 48 fakta över tiotalet. En familj hamnar i
den första del som passar: noll, ett mer, tio, dubblor, tiokamrater, små summor
(summa högst 5), nära dubblor, inom 10 och sist över tiotalet.

Ett mer kommer först, så att barnets första fakta är 1 + 1 och inte 0 + 0.
Inom noll kommer 0 + 0 och 0 − 0 sist. Noll, ett mer och tio och några är nästan
hälften av alla fakta. De flesta
7-åringar kan dem redan, och då markerar **startkollen** dem som kända med drygt
20 frågor (J4). Startkollen följer grafen: en missad del hoppar bara över det som
bygger på den, och andra grenar testas ändå. Vågen ingår inte i startkollen.

## Likhetstecknet i varierade format

Samma fakta frågas i olika format (`present.ts`):

| Format | Exempel | Addition | Subtraktion |
|---|---|---|---|
| vanligt | `13 − 5 = __` | 70 % | 60 % |
| omvänt | `__ = 13 − 5` | 30 % | 25 % |
| saknad term | `5 + __ = 13` | – | 15 % |

En ny fakta visas i vanligt format de första två gångerna. Alla format är
hämtning av samma fakta och räknas som bevis. Formatet sparas i svarsloggen.

**Vågen** (`equality.ts`) har 24 egna uppgifter i delen Likhetstecknet:

- likheter med en lucka, till exempel `7 + 5 = __ + 8` och `__ + 4 = 3 + 5`
- ”stämmer det?”, till exempel `6 = 6`, `3 + 4 = 4 + 3` och `9 = 4 + 4`, som bara
  besvaras med flerval (ja eller nej)
- samma tal, till exempel `8 = __`

Delen är förståelse. Den bedöms på rätt svar på olika dagar och i olika format,
utan tidsgräns.

## Felsvar kopplade till missuppfattningar

| Missuppfattning | Exempel |
|---|---|
| räknar startstenen, eller ett hopp för lite | 8 + 5 = 12 eller 14 |
| fel räknesätt | 8 + 5 = 3, 13 − 5 = 18 |
| omkastade siffror | 13 och 31 |
| glömmer tiotalet | 9 + 4 = 3 |
| tar mindre siffra från större i entalen | 13 − 5 = 12 |
| likhetstecknet som ”svaret kommer här” | `7 + 5 = __ + 8`: 12 (vänstra sidan) eller 20 (allt ihop) |

Ett fel svar som är en sådan förväxling får en vänlig förklaring i hjälpkortet
(`confusionNote`), till exempel ”Man kan inte ta 5 från 3. Gå ner till 10 först:
13 − 3 = 10.”

## Räknestigar

68 fakta har en stig (`derive.ts`). Barnet ska kunna välja strategi efter
uppgift, och samma tallinje fungerar åt båda hållen (J3):

| Strategi | Exempel |
|---|---|
| fyll upp till tio | 8 + 2 = 10 → 10 + 3 → 8 + 5 |
| nio plus | 10 + 6 = 16 → 16 − 1 → 9 + 6 |
| nära dubblor | 6 + 6 = 12 → 12 + 1 → 6 + 7 |
| ner till tio | 13 − 3 = 10 → 10 − 2 → 13 − 5 |
| räkna upp, när talen ligger nära | 9 + 1 = 10 → 10 + 2 = 12 → 1 + 2 → 12 − 9 |

En stig bygger bara på fakta i tidigare delar. Ingen etikett visar svaret innan
barnet har svarat.

## Tallinjen

Varje fakta har landningspunkterna för tallinjen (`landings`, J2). Vid 8 + 5 är
det 8 → 10 → 13, vid 13 − 5 är det 13 → 10 → 8 och vid 12 − 9, räknat uppåt,
9 → 10 → 12. Tiokamrater, dubblor och nära dubblor har också en tiotalsram.

## Platsen

Barnet når bäcken från dalen: platsen på kartan (bäcken med en liten bro) eller
huvudknappen ”Gå till bäcken” när trädgården vilar. Djuret i sidhuvudet leder
tillbaka till dalen.

- **Humör i dalen.** ”Nya stenar väntar vid bäcken.” innan något är övat,
  ”Bäcken har något att visa dig.” när dagens pass återstår och ”Bäcken vilar.
  Kom tillbaka i morgon!” när det är gjort.
- **Bron** (`components/bridge.ts`) har ett block per del om fakta, i delarnas
  ordning. En öppen del har en streckad plats, blocket fylls med andelen fakta som
  är minst flytande och räknas som lagt vid 80 % (`LAID_AT`). Blocken är fyrkantiga
  och huggna, så att de inte förväxlas med tallinjens runda stenar (J7). Vågen är
  inget block.
- **På kartan** är bron ett stenvalv över dalens egen bäck, en sten per del. En
  öppen del har sin plats i valvet och fylls inifrån; en del som inte är öppen än
  är en lucka. Tills alla stenar ligger står en byggställning av trä under valvet.
  Skylten står vid brons högra fot, och bäcken rinner ner längs vänster sida.
- **Tangenterna** vid bäcken är släta stenar, i trädgården trä.
- **Delarna** står under bron med ”8 av 16” och en stapel. Bara öppna delar visas.
- **Startkoll.** Första gången vid bäcken, innan något är övat, erbjuds startkollen
  en gång (`brookCheckOffered:<profil>`). Svaren ges på sifferknappsatsen, tiden
  mäts till första siffran och ingen rätt- eller fel-markering visas. Kollen kan
  göras om från föräldravyn.
- **Ny fakta.** Kortet ”En ny sten” visar faktan med lucka, hoppen mellan
  landningspunkterna (animerade, 700 ms per hopp) och tiotalsramen där den finns.
  Uppläsningen säger landningspunkterna: ”8 … 10 … 13” (J2). Sedan visas svaret
  och strategin, och barnet trycker ”Nu du!”.
- **Frågan.** Så länge en fakta är helt ny står tallinjen kvar vid frågan, med
  startstenen markerad men utan hopp. Vid Vågen står vågen vid frågan, med
  ”Vad ska stå i rutan?” eller ”Stämmer det?”. Ja står alltid till vänster om Nej.
- **Tid.** Vid tvåsiffriga svar mäts tiden till första siffran (J5).
- **Räknestigen** visar tallinjen med startstenen men utan hopp, eftersom hoppen
  skulle avslöja svaret på stegen.
- **Hjälpkortet** visar ”Du svarade 12. Så här kan du tänka:”, faktan med svaret
  (luckan ifylld), en eventuell förklaring av förväxlingen, strategin och
  tallinjen med hoppen, eller vågen.
- **Smal telefon.** Under 560 px visar tallinjen ett fönster med 11 stenar runt
  hoppen i stället för hela 0–20.
- **Dagens tid** delas efter hur mycket som är förfallet till repetition på varje
  plats, minst 5 minuter per plats (`dayPlan.ts`, se README).
- **Ett nytt barn börjar här.** Startkollen vid bäcken är det första barnet
  möter, och Trädgården öppnar när dubblor och övergången över tiotalet sitter.
- **Föräldravyn** har en egen del för bäcken: antal fakta per status, en
  värmekarta över additionstabellen 0–10, varje del med hur många plus- och
  minusfakta som sitter, svåra just nu med strategin, de vanligaste
  förväxlingarna, Vågen per uppgiftstyp och ”Gör om startkollen vid bäcken”.

## Bäckens koll (`check.ts`)

Träffsäkerheten i passet säger inte vad barnet kan, eftersom motorn håller den
runt 80–90 % med flit. Därför finns en separat koll med 13 uppgifter efter samma
mall varje gång, utan anpassning efter barnet:

| Sort | Antal | Exempel |
|---|---|---|
| Inom 10 | 3 | 3 + 5, 8 − 3 |
| Plus över tiotalet | 3 | 8 + 5 |
| Minus över tiotalet | 3 | 13 − 5 |
| Likhetstecknet i nya former | 4 | 8 + 4 = __ + 5, __ + 6 = 9 + 4 |

- Uppgifterna dras slumpvis inom varje sort och turas om. De väljs aldrig efter
  vad barnet kan. Likheterna finns inte bland Vågens 24 övade uppgifter, så de
  mäter transfer.
- Barnet svarar fritt på stenarna. Ingen rätt- eller fel-markering visas och
  ingen klocka syns. Tiden mäts till första siffran.
- Kollen kommer före passet, första gången på barnets andra speldag vid bäcken
  (en baslinje) och sedan ungefär var sjunde speldag. ”Inte nu” skjuter den till
  en annan dag.
- Kollen ändrar inte vad bäcken vet om barnet. Resultatet sparas som ett pass med
  typen `check`, med antal rätt och snabba svar (under 3 s) per sort och tiden för
  varje uppgift (−1 vid fel). Det följer med i säkerhetskopian, så att piloten kan
  jämföra övade och oövade fakta.
- Föräldravyn visar varje koll som en rad: dag och rätt per sort.

## Simulering

Den simulerade eleven är samma minnesmodell som för Trädgården
([MOTORN.md](MOTORN.md#simulerade-elever)). Eleven kan redan noll, ett mer, tio
och några och små summor. Tabellen visar 26 veckor med pass ungefär 6 dagar i
veckan, med två slumpfrön (`tests/simulation/addition.test.ts`):

| Elev | Första övergången över tiotalet, med startkoll | Utan startkoll | Rätt under inlärningen | Övergångar som sitter efter 26 v |
|---|---|---|---|---|
| svag | dag 43–47 | dag 49–60 | 76–78 % | 3–10 av 48 |
| genomsnittlig | dag 13–17 | dag 26–41 | 81–88 % | 45–47 av 48 |
| stark | dag 9–10 | dag 21–25 | 93–96 % | 48 av 48 |

Startkollen tar drygt 20 frågor, och barnet når övergångarna två till tre veckor
tidigare.

**Fynd att följa upp i piloten:**

- **Den svaga eleven** ligger under målbandet (76 %). Felen kommer främst från
  repetitionerna av övergången över tiotalet: cirka 60 % rätt på förfallna
  repetitioner och 50 % på räknestigarna. Takten stoppar nya fakta, men den kan
  inte göra repetitionerna lättare. Möjliga åtgärder: tallinjen kvar längre för
  svåra fakta, fler stigar per pass, eller en lägre gräns för när en fakta räknas
  som svår.
- **Modellen behandlar Vågen som fakta att minnas,** vilket är pessimistiskt för
  förståelse. Därför har Vågen lägre svårighet i simuleringen.

Simuleringen är kalibrerad för multiplikation och 8–9-åringar. Siffrorna är
därför antaganden att pröva i piloten, inte resultat.
