# Bäcken

Bäcken är dalens andra plats: addition och subtraktion inom 20 som faktafamiljer,
på en linjär, numrerad tallinje, och likhetstecknet i varierade format från
första veckan. Planen och upphovspersonens justeringar finns i
[PLAN-BACKEN.md](PLAN-BACKEN.md). Den här filen beskriver innehållet
(`src/content/addition`), som är byggt i fas B. Platsen med skärmar och bro
kommer i fas C.

## Fakta och familjer

Termerna går från 0 till 10, så summorna når upp till 20. Varje uträkning är en
egen fakta (`8+5`, `13-5`): 121 additioner och 121 subtraktioner, alltså 242
fakta. Familjen {5, 8, 13} består av 5 + 8, 8 + 5, 13 − 5 och 13 − 8. Hela
familjen ligger i samma del. Varje fakta har en tvilling åt andra hållet:
8 + 5 och 5 + 8, och 13 − 5 och 13 − 8.

## Delar och graf

| Ordning | Del | Antal | Kräver |
|---|---|---|---|
| 1 | Noll | 42 | – |
| 2 | Ett mer, ett mindre | 38 | – |
| 3 | Små summor | 4 | ett mer |
| 4 | Tio och några | 34 | ett mer |
| 5 | Tiokamrater | 12 | små summor |
| 6 | Dubblor och hälften | 16 | små summor |
| 7 | Inom 10 | 24 | tiokamrater |
| 8 | Nära dubblor | 24 | dubblor |
| 9 | Över tiotalet | 48 | tiokamrater, tio och några |
| 10 | Likhetstecknet (Vågen, förståelse) | 24 | tiokamrater |

En del öppnas när cirka 80 % av varje förkunskap är flytande. En familj hamnar i
den första del som passar: noll, ett mer, tio, dubblor, tiokamrater, små summor
(summa högst 5), nära dubblor, inom 10 och sist över tiotalet.

Noll, ett mer och tio och några är nästan hälften av alla fakta. De flesta
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

**Fynd att följa upp i fas C och i piloten:**

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
