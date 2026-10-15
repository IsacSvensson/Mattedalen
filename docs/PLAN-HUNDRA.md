# Plan: talen till 100, och en tydligare väg in i gånger

Dalen har i dag två platser. Bäcken tar barnet genom talen till 20, och
Trädgården tränar gånger och delat med. Mellan dem saknas ett steg som skolan
alltid tar: **talen till 100**. Gånger bygger på det, men inget i appen tränar
det. Planen lägger till en tredje plats, **Stigen**, och gör ordningen i
trädgården tydligare.

Planen är ett förslag. Avsnittet [Att ta ställning till](#att-ta-stallning-till)
listar det som behöver avgöras innan något byggs. Kopplingarna till skolan är
sammanfattade och ska stämmas av mot Skolverkets text (se
[OVERLAMNING-MATTEDALEN.md](OVERLAMNING-MATTEDALEN.md), Fällor punkt 3).
Progressionen anges i ålder och nivå, inte i årskurser.

## Varför

### Hur skolan brukar göra

Lgr22 bestämmer inte ordningen inom de första skolåren, och läromedlen skiljer
sig åt. Men de flesta följer ungefär samma väg:

1. **Talen till 10 och till 20** (ungefär 6–7 år): talkamrater, tiokamrater,
   dubblor, likhetstecknet och sedan att gå över tiotalet. Det är Bäcken i dag.
2. **Talen till 100** (ungefär 7–8 år): tiotal och ental, hundraplattan och
   tallinjen, att hoppa tio i taget, och addition och subtraktion där man går
   över ett tiotal (47 + 8, 52 − 6). Det saknas i dag.
3. **Gånger och delat med som begrepp** (samtidigt eller strax efter): lika
   stora grupper, upprepad addition, att hoppa i steg (2, 4, 6 …), att dela
   lika. Delat med har Dela lika, men gånger har ingen förståelsedel.
4. **Tabellerna** (ungefär 8–10 år): först 2, 5 och 10, sedan de som kan
   härledas (4 som dubbla 2, 9 som 10 minus en grupp, 6 som 5 plus en grupp),
   sist 7 och 8. Det är Trädgården, och ordningen stämmer.

### Vad trädgården kräver i dag, utan att träna det

Räknestigarna, alltså de steg barnet tar sig fram med när en fakta är svår,
räknar redan med tal upp till 100. Så här ser de ut i dag (`derive.ts`):

| Tabell | Steg i räknestigen | Färdighet som krävs |
|---|---|---|
| ×10 | (ingen stig) men 7 × 10 = 70 är sju tiotal | tiotal |
| ×5 | hälften av 70 | halvor av hela tiotal |
| ×3 | 14 + 7, 18 + 9 | tvåsiffrigt plus ental, över tiotalet |
| ×4 | 14 + 14, 18 + 18 | dubbla tvåsiffriga tal |
| ×6 | 35 + 7, 40 + 8 | tvåsiffrigt plus ental, över tiotalet |
| ×9 | 60 − 6, 80 − 8 | tiotal minus ental, under tiotalet |
| Kvadrattal | 35 + 14, 32 + 32, 90 − 9 | tvåsiffrigt plus tvåsiffrigt |
| ×7 och ×8 | 28 + 28 | dubbla tvåsiffriga tal, över tiotalet |
| Delat med | 30 + 6 + 6, 60 − 6 − 6, 45 + 9 + 9 | samma som tabellen |

Bäcken slutar vid 20. Ett barn som går direkt från bäcken till ×6 möter alltså
huvudräkning som det aldrig har övat, just när det redan tycker att faktan är
svår.

## Beslut (förslag)

1. **En ny plats, Stigen, för talen till 100.** Stenstigen i dalen mellan
   Bäcken och Trädgården blir en plats. Den bygger på Bäcken på samma sätt som
   Bäcken bygger på inget.
2. **En tabell öppnar när stegen i dess räknestigar går att ta.** ×10 väntar på
   tiotalen, ×3 och ×6 på att gå över ett tiotal, ×4 och ×7/×8 på att dubbla
   tvåsiffriga tal, och så vidare (se [Grafen](#grafen-mellan-platserna)). Det
   är samma regel som redan styr Bäckens delar och delat med: det som bygger på
   något väntar tills det sitter.
3. **Gånger får en förståelsedel först: ”Lika stora grupper”.** Som Dela lika
   och Vågen: bedöms på rätt svar på olika dagar, aldrig på tid.
4. **×2 kommer före ×10.** ×2 är dubblorna barnet just har lärt sig vid bäcken.
   ×10 kommer när tiotalen sitter på Stigen.
5. **Trädgården öppnar tidigare,** när Dubblor och hälften sitter vid bäcken.
   Barnet kan då börja med Lika stora grupper och ×2 medan Stigen tränar talen
   till 100. Det är så skolan gör: begreppet gånger kommer innan additionen
   till 100 är automatiserad.
6. **Det som är påbörjat stängs aldrig.** Ett barn som redan har plantor i ×6
   fortsätter med ×6. Bara helt nya tabeller väntar på Stigen.

## Stigen

### Innehåll

Som Bäcken: en graf av delar, förståelse där det behövs och fakta där
automatik är målet. Tal upp till 100, inga negativa tal och inga svar över 100.

| Del | Exempel | Bygger på | Slag |
|---|---|---|---|
| Hela tiotal | 3 tiotal = 30, 70 = __ tiotal, 40 + 30, 90 − 20 | Bäcken: Tio och några | fakta |
| Tiotal och ental | 47 = 4 tiotal och 7 ental, vilket tal är 6 tiotal och 3 ental? | Hela tiotal | förståelse |
| Ental utan att gå över | 34 + 5, 47 − 3 (som 4 + 5 och 7 − 3) | Tiotal och ental | fakta |
| Till nästa tiotal | 37 + __ = 40, 60 − 4 | Tiotal och ental, och Bäcken: Tiokamrater | fakta |
| Över tiotalet | 47 + 8, 52 − 6, 35 + 7 | Ental utan att gå över och Till nästa tiotal, och Bäcken: Över tiotalet | fakta |
| Hoppa tio | 34 + 10, 58 − 20, 26 + 30 | Tiotal och ental | fakta |
| Dubbla och halvera | dubbla 14, dubbla 28, hälften av 70, hälften av 56 | Tiotal och ental, och Bäcken: Dubblor och hälften | fakta |
| Tvåsiffrigt plus tvåsiffrigt | 34 + 25, 35 + 14, 47 + 36 | Hoppa tio, och Över tiotalet | fakta |

224 uppgifter (H3, se [STIGEN.md](STIGEN.md)). Uppgifterna väljs så att de täcker det som räknestigarna i
trädgården använder, och lite till. Det är inte hela talområdet, eftersom 100 ×
100 kombinationer varken går att träna eller behövs.

### Hur man tänker

- **Stegvis på en tom tallinje** som huvudstrategi: 47 + 8 är 47 + 3 = 50, sedan
  + 5 = 55. 34 + 25 är 34 + 20 = 54, sedan + 5 = 59. Den håller även för
  subtraktion, där att räkna tiotal och ental för sig ofta leder till fel
  (52 − 6 blir 54).
- **Tiotal och ental för sig** visas som andra sätt för addition (34 + 25 är
  50 + 9), med tiostavar och entalskuber.
- **Hundraplattan** visar att ett hopp på tio är ett steg rakt ned och ett hopp
  på ett är ett steg åt sidan.
- **Räknestigar** finns som i Bäcken och Trädgården: 47 + 8 tas som 47 + 3, sedan
  50 + 5.

### Bilder

Alla bilder byggs som komponenter, som tallinjen och tiotalsramen vid bäcken:

- **Tiostavar och entalskuber:** 47 som fyra stavar och sju kuber. I förståelsedelen
  bygger barnet talet själv genom att dra stavar och kuber (som bygget av
  rektangeln i trädgården), eller trycka.
- **Tom tallinje med hopp:** samma komponent som vid bäcken, med tiotalen
  utmärkta och hopp på 10 och på ental.
- **Hundraplattan:** tio rader med tio tal, där hoppen syns.

### Platsen

Stenstigen i dalen går redan mellan Bäcken och Trädgården. Som plats blir den en
stig med en stolpe vid varje tiotal, 10, 20 och så vidare upp till 100.

- **Kunskapen syns som lyktor** på stolparna: en lykta tänds för varje del som
  sitter. Det är en egen form, så att den inte blandas ihop med bäckens stenar
  eller trädgårdens plantor.
- **Barnets djur** står vid stolpen för den del barnet övar på.
- **På kartan** syns stigen med sina tända lyktor.

### Startkoll och koll

- **Startkoll:** som vid bäcken. Ett barn som redan kan talen till 100 ska inte
  behöva gå igenom dem. Den kan bara flytta fram barnet.
- **Stigens koll:** ungefär var sjunde speldag på stigen, samma mall varje gång,
  utan anpassning. Resultatet visas bara i föräldravyn.

## Trädgården

### Lika stora grupper (förståelse)

Den första delen i trädgården, före ×2. Omkring 16 uppgifter med bild och
flerval:

- **Grupper:** 3 korgar med 4 jordgubbar i varje. Hur många jordgubbar?
- **Upprepad addition:** 4 + 4 + 4 är lika mycket som 3 × 4.
- **Hoppa i steg** på tallinjen: 5, 10, 15, __.
- **Samma sak två gånger:** 3 korgar med 4 och 4 korgar med 3 ger lika många
  (en förberedelse för att vända på).

Bilderna är trädgårdens egna: bär, korgar och rader i lådan. Dela lika kommer
efter den, som i dag.

### Ny ordning för tabellerna

Tabellerna blir en graf, som Bäckens delar, i stället för en kedja:

| Tabell | Öppnar efter (i trädgården) | och på Stigen |
|---|---|---|
| ×2 | Lika stora grupper | – |
| ×10 | ×2 | Hela tiotal |
| ×5 | ×10 | Dubbla och halvera |
| ×1 | ×2 | – |
| ×4 | ×2 | Dubbla och halvera |
| ×3 | ×2 | Över tiotalet |
| Kvadrattal | ×4 och ×3 | Tvåsiffrigt plus tvåsiffrigt |
| ×9 | ×10 | Över tiotalet |
| ×6 | ×5 | Över tiotalet |
| ×7 och ×8 | ×6 och ×4 | Dubbla och halvera, och Tvåsiffrigt plus tvåsiffrigt |

Delat med följer tabellerna som i dag: delen Dela med 3 öppnar efter ×3 och
familjens multiplikationer, och så vidare. Spåren för nya fakta (`Unit.lane`)
gäller också mellan gånger och delat med.

### Grafen mellan platserna

```
Bäcken                         Stigen                         Trädgården
Tio och några ───────────────▶ Hela tiotal ──────────────────▶ ×10
Dubblor och hälften ─────────────────────────────────────────▶ öppnar Trädgården
                               Dubbla och halvera ───────────▶ ×5, ×4
Tiokamrater, Över tiotalet ──▶ Över tiotalet ────────────────▶ ×3, ×9, ×6
                               Tvåsiffrigt + tvåsiffrigt ────▶ Kvadrattal, ×7 och ×8
```

Stigen öppnar när Över tiotalet sitter vid bäcken. I dag är det, tillsammans
med dubblorna, villkoret för att Trädgården ska öppna.

## Barn som redan spelar

- **Påbörjade tabeller fortsätter.** En del i trädgården som barnet har börjat
  på väntar aldrig på Stigen. Det gäller också barn från Gångerträdgården.
- **Nya tabeller väntar** på sina delar på Stigen. Barnet ser i trädgården en
  vänlig rad: ”×6 kommer när du kan gå över tiotalet på stigen.” Den vuxna ser
  samma sak i föräldravyn.
- **Startkollen på Stigen** erbjuds första gången, så att ett barn som redan
  kan talen till 100 kommer vidare direkt.
- **En vuxen kan öppna** en tabell i föräldravyn, som i dag med Trädgården.
- **Lika stora grupper** läggs inte i vägen för barn som redan kan ×2: den räknas
  som klar för barn som redan har ×2 som buskar.

## Teknisk design

- **Motorn: delar som väntar på något utanför paketet.** En ny regel
  `heldUnitIds` i passets indata: delar som inte får öppna än, fast deras egen
  regel är uppfylld. Platsen räknar ut dem från den andra platsens framsteg,
  som Trädgårdens öppning redan gör med Bäcken (`opening.ts`). Fakta som redan
  är introducerade påverkas inte, och repetition fortsätter som vanligt. Motorn
  vet inget om platser.
- **Trädgårdens paket:** delen `lika` (förståelse) först, tabellernas regler som
  `after` i stället för `previous`, och ×2 före ×10. Paketversion 3. Fakta behåller
  sina id:n, så sparade framsteg, säkerhetskopior och QR-koder läses som i dag.
- **Stigens paket:** `src/content/hundred` med fakta, delar, graf, former,
  räknestigar och felsvar, som `content/addition`.
- **Platsen:** `src/places/stigen`, som Bäcken: skärmen, passets bilder,
  föräldradelen, startkollen och kollen.
- **Dagens plan:** högst två platser om dagen, som i dag. Stigen får sin andel
  efter vad som väntar på repetition.
- **QR (`MD1:`)** och säkerhetskopior får ett block för Stigen.
- **Simulering:** en simulerad elev går från bäcken genom stigen till
  trädgården. Den ska visa hur länge tabellerna väntar på stigen, och att det
  inte blir en flaskhals.

## Faser

| Fas | Innehåll |
|---|---|
| H1. Trädgårdens ordning **(klar)** | Lika stora grupper, ×2 först, tabellerna som graf, Trädgården öppnar efter dubblor. Fungerar utan Stigen. |
| H2. Motorn **(klar)** | `heldUnitIds`, tester och simulering. |
| H3. Stigens innehåll **(klar)** | Paketet: delar, fakta, former, räknestigar, felsvar. Bakom en flagga. |
| H4. Stigen som plats **(klar)** | Skärmen med stolpar och lyktor, bilderna (stavar och kuber, tom tallinje, hundraplatta), kartan, föräldradelen. |
| H5. Kopplingen | Tabellerna väntar på Stigen, raden i trädgården, startkoll, koll, QR och säkerhetskopior. Stigen slås på. |
| H6. Verifiering | e2e, skärmbilder i alla storlekar, dokumentation. |

H1 kan byggas och släppas för sig. Den löser luckan om förståelse för gånger
direkt, även om Stigen dröjer.

## Fynd från H1

- **Ordningen och grafen.** ×2 kommer först, och tabellerna öppnar efter det
  deras strategier bygger på (`TABLE_AFTER`). Nya fakta kommer i samma ordning
  som förut, med ×2 och ×10 bytta. Paketet är version 3; de 100 multiplikationerna
  ligger kvar först och de nya uppgifterna sist, så gamla QR-koder och
  säkerhetskopior läses som förut.
- **Startkollen** prövar nu tabellerna som en graf. En förkunskap som kollen inte
  prövar (förståelse) håller inte tillbaka. Efter kollen är allt öppet som bygger
  på det barnet kan: ett barn som kan ×2, ×10, ×5 och ×1 får ×4, ×3, ×9 och ×6
  som grävd jord, men de nya fakta kommer ändå från ×4 först.
- **Barn som redan spelar** och kan minst hälften av ×2 räknar Lika stora grupper
  som klar (`knowsGroupsAlready`, via `GameDeps.prepare`), så uppgifterna inte
  står före nästa tabell.
- **En ny trädgård** är äng tills ×2 öppnar. En rad under lådan säger varför:
  ”Först: lika stora grupper. Sedan planterar vi ×2.”
- **Simulering:** den genomsnittliga eleven har ungefär som förut 89–90 av 100
  divisioner och 94–95 av 100 multiplikationer som sitter efter 26 veckor. Den
  svaga eleven har 12 divisioner som sitter mot 22 förut: de 16 uppgifterna i Lika
  stora grupper tar plats bland de första nya fakta. Det är priset för att
  begreppet kommer först.
- **Mot en vuxen** drog kort från den första delen när barnet kunde för lite. Den
  delen är nu Lika stora grupper, så den drar nu från den första tabellen.

## Fynd från H2

- **Regeln** är `heldUnitIds` i passet och `Held` i `computeUnlocked`. En hållen
  del öppnar inte, varken i dagens pass eller i ett fokuspass. Det som redan är
  öppet eller påbörjat hålls aldrig. I startkollen öppnar en hållen del bara om
  barnet klarar den.
- **Simulering** (`tests/simulation/held.test.ts`): när ×4 och tabellerna efter
  hålls i sex veckor går passen som vanligt, med repetition och samma träffsäkerhet,
  och tabellerna öppnar så fort de släpps. Efter 20 veckor sitter 98 av 100 fakta,
  mot 99 utan väntan.
- **Kopplingen** till skalet (`GameDeps`) görs i H5, när Stigen finns att räkna
  från.

## Fynd från H3

- **Paketet** är `src/content/hundred` med 224 uppgifter i åtta delar. Det
  beskrivs i [STIGEN.md](STIGEN.md). Ingen plats använder det än: det är flaggan
  tills Stigen slås på i H5.
- **Färre uppgifter än först tänkt.** Med drygt 300 uppgifter kom ett
  genomsnittligt simulerat barn till Över tiotalet först efter 16 veckor. Med 224
  och den nya grafen tar det ungefär tio veckor. Varje steg i trädgårdens
  räknestigar finns fortfarande med, och ett test kontrollerar det.
- **Grafen ändrades lite mot förslaget.** Till nästa tiotal kräver inte
  längre Ental utan att gå över, men Över tiotalet kräver båda, eftersom dess
  räknestigar använder båda (47 + 3, sedan 50 + 5). Dubbla och halvera kräver
  Tiotal och ental, eftersom 14 + 14 är 10 + 10 och 4 + 4.
- **Hoppa tio** står efter Över tiotalet i ordningen. Den öppnar lika tidigt,
  men dess nya uppgifter kommer medan barnet väntar på att Över tiotalet ska
  öppna. **Dubbla och halvera** har ett eget spår, så att trädgårdens ×5 och ×4
  inte väntar på bron över tiotalet.
- **60 − __ = 56** blev `60 − 4 = __` med formen `4 + __ = 60`. En form måste ha
  samma svar som uppgiften. Vägen upp är egna uppgifter: `37 + __ = 40`, med
  formen `40 − 37 = __`.
- **Ett svagt barn** når inte Över tiotalet på ett halvår i simuleringen, och
  modellen räknar inte med att 40 + 30 bygger på 4 + 3. I H5 behöver vi se hur
  länge trädgårdens tabeller då väntar. En vuxen kan öppna en tabell.
- **Subtraktion med två tvåsiffriga tal** (75 − 23) finns inte med, som i planen.
  Den kan bli en egen del senare.

## Fynd från H4

- **Platsen** finns i `src/places/stigen` och beskrivs i [STIGEN.md](STIGEN.md#platsen).
  Den syns bara med `?stigen` tills H5 slår på den.
- **Tio stolpar och åtta delar.** Stolparna står vid 10, 20 … 100. Lyktorna hänger
  på stolparna 20 till 90, en för varje del. Siffrorna sitter överst på stolparna,
  så att barnets djur kan stå mellan dem utan att dölja dem.
- **Kartan.** Med tre platser fick stigen inte plats utan att täcka trädgården.
  Kartan blir därför lite högre på en stående telefon när stigen finns. På en
  liggande telefon står stigen i hörnet till höger om bäckens skylt.
- **Hundraplattan** tog för mycket plats tillsammans med tallinjen i en ny
  uppgift. En ny uppgift i Hoppa tio visar därför bara hundraplattan. Hjälpkortet
  visar båda.
- **Hjälpkortet** fyller nu i luckan även när uppgiften har ord: ”3 tiotal = 30”
  i stället för ”3 tiotal = __ Svaret är 30.” Det gäller också trädgårdens
  hoppuppgifter.
- **Startkollen och kollen** väntar till H5, som planen säger. Det gör också regeln
  att Stigen öppnar efter Över tiotalet vid bäcken. Med flaggan är Stigen öppen
  direkt.
- **QR och säkerhetskopior:** QR-koden tar med ett block för varje plats på
  kartan, och säkerhetskopian tar med allt barnet har övat. Med flaggan kommer
  Stigen alltså med. Det prövas i H5.

## Avgjorda frågor

Avgjort enligt förslagen:

1. **Namnet och bilden:** Stigen, med en stolpe vid varje tiotal och lyktor som
   tänds för delar som sitter.
2. **Hårda spärrar:** nya tabeller väntar på sina delar på Stigen. Det som är
   påbörjat stängs aldrig, och en vuxen kan öppna en tabell.
3. **Trädgården öppnar efter dubblorna** vid bäcken.
4. **×2 kommer före ×10.**
5. **Talområdet är 0–100 nu.** 200 och 1000 kan bli en egen del senare.
6. **×0 stannar utanför tabellerna**, eftersom rutnätet, QR-koderna och
   plantorna bygger på 1–10. Nollan kommer in som begrepp i Lika stora grupper i
   stället: 3 tomma korgar är 0 jordgubbar.
