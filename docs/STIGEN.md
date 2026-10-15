# Stigen

Stigen blir dalens tredje plats: talen till 100. Den ligger mellan Bäcken och
Trädgården. Planen finns i [PLAN-HUNDRA.md](PLAN-HUNDRA.md). Innehållet
(`src/content/hundred`) byggdes i fas H3 och platsen (`src/places/stigen`) i H4.
Den slås på för alla i H5.

Tills dess syns Stigen bara på en enhet där appen har öppnats med `?stigen` en
gång (`src/shell/features.ts`). Valet sparas i webbläsaren på enheten. Med
`?stigen=0` försvinner den igen.

## Uppgifterna

Stigen har 224 uppgifter. Det är inte alla uträkningar upp till 100, eftersom de
varken går att träna eller behövs. Uppgifterna är valda så att de täcker varje
steg som trädgårdens räknestigar tar (35 + 7, 60 − 6, 28 + 28, hälften av 70 …),
och lite till. Ett test kontrollerar det: varje steg över 20 i trädgårdens
räknestigar finns på Stigen.

Talen går från 0 till 100. Inga tal är negativa och inga svar är över 100.

Det finns sex slags uppgifter:

| Slag | Exempel | Id |
|---|---|---|
| Uträkning | 47 + 8, 52 − 6, 14 + 14 | `47+8`, `52-6`, `14+14` |
| Tiotal till tal | 3 tiotal = __ | `tens:3` |
| Tal till tiotal | 70 = __ tiotal | `count:70` |
| Upp till tiotalet | 37 + __ = 40 | `next:37` |
| Hälften | hälften av 56 | `half:56` |
| Tiotal och ental | 47 = __ tiotal och 7 ental | `te:47:t` (och `te:63`, `te:47:e`, `te:47:byt`, `te:3t14e`) |

## Delar och graf

| Ordning | Del | Antal | Kräver | Vid bäcken |
|---|---|---|---|---|
| 1 | Hela tiotal | 30 | – | Tio och några |
| 2 | Tiotal och ental (förståelse) | 22 | hela tiotal | |
| 3 | Ental utan att gå över | 31 | tiotal och ental | |
| 4 | Till nästa tiotal | 32 | tiotal och ental | Tiokamrater |
| 5 | Över tiotalet | 28 | ental, till nästa tiotal | Över tiotalet |
| 6 | Hoppa tio | 33 | tiotal och ental | |
| 7 | Dubbla och halvera (eget spår) | 36 | tiotal och ental | Dubblor och hälften |
| 8 | Tvåsiffrigt plus tvåsiffrigt | 12 | hoppa tio, över tiotalet | |

En del öppnar när cirka 80 % av varje del den kräver är flytande. Kolumnen ”Vid
bäcken” är det som delen bygger på vid bäcken (`BROOK_PREREQUISITES`). Platsen
håller delen tills det sitter (H5). Motorn vet inget om bäcken.

- **Hoppa tio** öppnar lika tidigt som entalen. Men dess nya uppgifter kommer när
  barnet väntar på att Över tiotalet ska öppna, så att vägen dit inte blir längre.
- **Dubbla och halvera** har ett eget spår. Nya dubblor och halvor kommer
  omväxlande med de andra delarna. Trädgårdens ×5 och ×4 väntar på den här
  delen, inte på att gå över tiotalet.
- **Tiotal och ental** är förståelse, som Vågen vid bäcken. Den bedöms på rätt
  svar på olika dagar och i olika former, aldrig på tid. Startkollen prövar den
  inte.

## Hur barnet tänker

Huvudstrategin är **steg på en tom tallinje**, med tiotalet som mellanstation:

- 47 + 8 = 47 + 3 + 5 = 50 + 5 = 55
- 52 − 6 = 52 − 2 − 4 = 50 − 4 = 46
- 47 + 36 = 47 + 30 + 6 = 77 + 6 = 83
- 26 + 30: tre hopp på tio, 26, 36, 46, 56

För tvåsiffrigt plus tvåsiffrigt och för dubblor finns också **tiotal och ental
för sig** som ett annat sätt (34 + 25: 30 + 20 = 50 och 4 + 5 = 9, alltså 59).
Det ligger som en extra ledtråd (`split`). För subtraktion visas det inte, eftersom det ofta leder till felet
52 − 6 = 54.

Dubblor tas med tiotal och ental för sig: 28 + 28 = 40 + 16 = 56. Halvor delas
upp i ett jämnt antal tiotal och resten: hälften av 56 är hälften av 40 och
hälften av 16, alltså 20 + 8.

Varje uppgift har en ledtråd med strategin, och de flesta har hoppen på
tallinjen (`numberline`). Tiotal och ental har en ledtråd för stavar och kuber
(`base10`). Bilderna beskrivs under [Platsen](#platsen).

## Former

Som vid bäcken visas samma uppgift på olika sätt, så att likhetstecknet betyder
”är lika mycket som”. En uppgift som barnet nyss mött visas i vanlig form de
första två gångerna.

| Uppgift | Former |
|---|---|
| 47 + 8 | `47 + 8 = __` (70 %), `__ = 47 + 8` (30 %) |
| 52 − 6 | `52 − 6 = __` (60 %), `__ = 52 − 6` (25 %), `6 + __ = 52` (15 %) |
| 14 + 14 | `14 + 14 = __` (60 %), `dubbla 14 = __` (25 %), `__ = 14 + 14` (15 %) |
| 37 + __ = 40 | som den står (70 %), `40 − 37 = __` (30 %) |

Varje form räknas som bevis.

## Räknestigar

En uppgift som barnet tycker är svår kan tas i steg, som vid bäcken. Stigen
börjar i en uppgift som barnet redan kan:

- **Över tiotalet:** 47 + 3 = 50 → 50 + 5 → 47 + 8
- **Ner till tiotalet:** 52 − 2 = 50 → 50 − 4 → 52 − 6
- **Tvåsiffrigt:** 47 + 30 = 77 → 77 + 6 → 47 + 36
- **Dubbla:** 20 + 20 = 40 → 8 + 8 = 16 → 40 + 16 → 28 + 28
- **Halvera:** hälften av 40 → hälften av 16 → 20 + 8 → hälften av 56

Det första steget är alltid en uppgift på Stigen i en tidigare del. 8 + 8 är
bäckens, och då är steget bara en uträkning.

## Felsvar

Svarsalternativen bygger på vanliga fel. Vid ett sådant fel säger hjälpkortet
något vänligt om det:

| Fel | Exempel | Hjälpkortet |
|---|---|---|
| Entalen åt fel håll | 52 − 6 = 54 | Man kan inte ta 6 från 2. Gå ner till 50 först. |
| Glömt det nya tiotalet | 47 + 8 = 45 | Glöm inte det nya tiotalet. |
| Tiotal lagda till entalen | 26 + 30 = 29 | 30 är 3 tiotal. Hoppa tio 3 gånger. |
| Ental lagda till tiotalen | 34 + 5 = 84 | 5 är ental. |
| Halva varje siffra | hälften av 56 = 23 | Dela upp 56 i 40 och 16. |
| Tiotal och ental bytta | 74 för 47 | Tiotalen står först. |
| Entalen kvar i 14 ental | 3 tiotal och 14 ental = 34 | Det tiotalet ska också räknas. |

## Platsen

### Stolparna och lyktorna

Stigen är en sandig stig med en stolpe vid varje tiotal, från 10 till 100. Siffran
står på en skylt överst på stolpen. Stolparna 20 till 90 bär en lykta var, en för
varje del i ordning. Stigen börjar vid 10 och slutar vid 100.

Lyktorna visar vad barnet kan, på samma sätt som bron vid bäcken och plantorna i
trädgården:

- **En del som inte är öppen** har bara en tom krok.
- **En öppen del** har en lykta med mörkt glas. Lågan växer när mer av delen
  sitter.
- **En del som sitter** (ungefär 80 %) har en tänd lykta med ett varmt sken.

Barnets djur står vid lyktan för den del barnet är på: den första öppna delen
som inte är tänd. Under stigen finns delarna med hur mycket som sitter, som vid
bäcken. Knappen heter ”Gå på stigen”. När dagens pass är klart vilar stigen.

### På kartan

Stigen står mellan bron och trädgården, med skylten bredvid. Den visar stolparna
i litet format och ett ljus för varje öppen del. Med tre platser blir kartan lite
högre på en stående telefon, så att varje plats får ett eget band. På en liggande
telefon står stigen i hörnet till höger om bäckens skylt.

### Bilderna i passet

- **Stavar och kuber** (`base10.ts`): 47 är fyra stavar och sju kuber. Kuberna
  ligger i staplar om fem, så 7 syns som 5 och 2.
- **Bygget:** en ny uppgift om tiotal och ental byggs först. Barnet trycker på
  ”tiotal” eller ”ental”, eller drar dem till brädet. Med minusknappen tas en bort.
  Med tio ental eller fler kan tio ental bytas mot ett tiotal. Bygget är klart när
  talet stämmer och färre än tio ental ligger kvar.
- **Tom tallinje** (`emptyLine.ts`): bara tiotalen är utmärkta, och hoppen ritas i
  skala. 18 + 6 visas som 18 → 20 → 24, med +2 och +4.
- **Hundraplattan** (`hundredChart.ts`): ett hopp på tio är ett steg rakt ner.
  En ny uppgift i Hoppa tio visas på hundraplattan.

En ny uträkning visas med hoppen på den tomma tallinjen. Medan uppgiften är ny
står tallinjen med startpunkten bredvid frågan. Hjälpkortet efter ett fel visar
hoppen, och för tvåsiffrigt och dubblor också stavar och kuber. Räknestigen visar
bara var man börjar, så att hoppen inte avslöjar svaret.

Svaren skrivs på stenar, som vid bäcken, och tiden räknas till första siffran.

### Föräldravyn

Stigens del visar hur mycket som sitter, hur långt barnet har kommit i varje del,
vad som är svårt just nu (med räknestigens sätt att tänka) och de vanligaste
förväxlingarna. Startkollen och Stigens koll kommer i H5.

## Simulering

`tests/simulation/hundred.test.ts` låter simulerade barn gå på Stigen i ett
halvår, med hela passen där. Modellen behandlar varje uppgift som en fakta att
minnas, också 40 + 30, fast barnet kan 4 + 3. Den är alltså försiktig.

- **Ett genomsnittligt barn** börjar på Över tiotalet efter ungefär tio veckor.
  Efter ett halvår sitter 82–86 % av den delen och 92 % av Tvåsiffrigt plus
  tvåsiffrigt. Dubbla och halvera börjar efter två veckor.
- **Ett starkt barn** börjar på Över tiotalet efter fyra veckor.
- **Ett svagt barn** kommer inte fram till Över tiotalet på ett halvår. Det ska
  vägas in i H5, när trädgårdens tabeller väntar på Stigen.
- **Ett barn som redan kan talen till 100** klarar startkollen för de första
  delarna och börjar på Över tiotalet inom två veckor.
- Barnen svarar rätt på 80–93 % av frågorna (det svaga barnet 71 %).
