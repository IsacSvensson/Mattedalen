# Trädgården

Trädgården är dalens första plats: multiplikationstabellen 1–10 som en
odlingslåda där varje fakta växer från frö till träd. Den är Gångerträdgården
(IsacSvensson/Multiplikation) flyttad in i Mattedalen, och inget har ändrats för
barnen. Motorn som väljer frågorna beskrivs i [MOTORN.md](MOTORN.md).

Barnet kommer hit från dalen (”Gå till trädgården” eller platsen på kartan), och
djuret i trädgårdens sidhuvud leder tillbaka till dalen.

## Multiplikationspaketet (`src/content/multiplication`)

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

## Spelet (`src/places/tradgarden`)

Spelet är skrivet i vanilla TypeScript med en liten `h()`-hjälpare (`dom.ts`). Det
har få skärmar och lite delat tillstånd, så ett UI-ramverk skulle bara ge vikt.
All grafik är inbäddad SVG: plantor, djur (`components/avatars.ts`), ikoner
(`components/icons.ts`) och landskapet (`components/scene.ts`). Typsnitten
(Fredoka och Nunito, SIL OFL, licenser i `src/shell/fonts/`) följer med appen, så
inget hämtas utifrån.

- **`play.ts`** (`PlayController`) kopplar ihop motorn och lagringen utan DOM.
  Efter varje svar sparas försöket och faktans tillstånd. När passet är slut sparas
  passets kvitto och elevens meta. Avbryter barnet passet tidigt finns framstegen
  kvar, men dagen räknas inte som klar. Allt detta testas med minneslagringen.
- **Profiler.** Flera barn kan använda samma enhet, och varje barn har namn och ett
  djur.
- **Odlingslådan** är 10×10-rutnätet som en odlingslåda av trä. Raden *a* och kolumnen
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

## Designregler

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

**Form.** Stilen är en varm bilderbok, inte ett UI-kit.

- Samma yttre kontur överallt: `--outline` (2 px, mörkbrun). Linjer inuti
  teckningarna är tunnare, och landskapet har konturer i sina egna toner: mörkgrönt
  på kullarna, mörkblått längs bäcken, varmt orange runt solen.
- Bara det man kan trycka på har en tryckkant under sig, alltid lika djup
  (3 px, `--press-depth`). Kanten är en mörkare ton av knappen själv
  (`--press-tone`): rostbrun under den orange knappen, mörkt trä under
  trätangenter, inte svart bläck. Den sjunker när man trycker.
- Kort ligger mjukt på papper (`--paper`, en mjuk varm skugga, `--lie`). Det som
  står i landskapet kastar en mjuk, färgtonad skugga på marken.
- Material: knappsatsen och svarsknapparna är ljusa trätangenter med ådring, och
  vid Bäcken släta stenar (`keys` i passets plats). Namnskyltarna i dalen är
  trätavlor på stolpar, och odlingslådan är byggd av plankor med mörk jord
  (`--soil`).
- Tre hörnradier: `--r-card` för kort, `--r-tile` för rutor och svarsknappar,
  samt rund eller piller för knappar.
- Typsnitt: Fredoka för rubriker och siffror, Nunito för text.
- En huvudknapp per skärm (orange). Övriga val är ljusa.
- Rätt svar visas i grönt. Fel svar visas lugnt och streckat, aldrig i rött.
- Inga emojis i gränssnittet. Profilerna sparar fortfarande djuret som emoji, så
  äldre profiler och säkerhetskopior fungerar, men det ritas som SVG.

## Startkoll (placering)

Ett barn som redan kan ×10, ×2, ×5 och ×1 ska inte behöva gå igenom dem igen.
Därför erbjuds en frivillig **startkoll** när en ny spelare skapas, och den kan
göras om från föräldravyn.

- **Motorn** (`engine/placement.ts`) är innehållsneutral. Den går igenom
  enheterna i ordning och frågar 4 slumpade fakta ur varje.
- **Godkänd enhet:** minst 3 av 4 rätt. Svarstiden avgör inte om enheten
  klaras, bara hur den placeras: med minst 3 snabba svar (under 6 s) blir den
  *flytande* (buskar), annars *lär sig* (plantor som ska bli snabbare). Små barn
  skriver långsamt på knappsatsen, och tidigare stoppades barn som kunde ×10 av
  att svaren tog några sekunder. Ett rätt svar som tar över 20 s har räknats
  fram steg för steg och räknas som fel. Det första svaret räknas aldrig som
  långsamt, eftersom barnet då också provar knappsatsen för första gången.
- **Andra chans:** med exakt två fel i en enhet kommer 2 extra frågor som båda
  måste vara rätt, alltså 4 av 6. Ett enstaka felslag stoppar då inte ett barn
  som kan enheten.
- **Slut:** kollen stannar vid den första enhet som inte klaras.
- **Svaren** ges på sifferknappsatsen, eftersom flerval ger för mycket
  gissning. Ingen rätt- eller fel-markering visas och ingen klocka syns.
- **Resultat** (`applyPlacement`): fakta i snabbt godkända enheter blir
  *flytande* (buskar), inte automatiserade, och läggs in för repetition
  utspritt över den första veckan. Fakta i långsamt godkända enheter blir
  *lär sig* (plantor) och kommer tillbaka inom tre dagar. Enheterna låses upp
  fram till den första som inte klarades. En för generös placering rättas därför av den vanliga
  repetitionen, eftersom ett fel svar sänker faktan ett steg. Startkollen kan
  bara flytta fram ett barn, aldrig bakåt.
- **Simulering:** genomsnittliga elever som redan övat de fyra lätta tabellerna
  placeras vid ×4 (7 av 8 frön) efter cirka 20 frågor. Den åttonde räknar ut
  ×4 långsamt genom att dubbla, och får ×4 som plantor. Efter placeringen ligger
  andelen rätt på 80–93 %, och efter sex veckor är minst 8 av 10 enheter
  upplåsta.

## Extralägen

Extralägena är frivilliga och tydligt valbara under huvudknappen i trädgården.
De påverkar inte schemaläggningen.

- **Öva en tabell** (`screens/focus.ts`). Barnet väljer ×1–×10. Varje
  tabell visar en liten stapel över hur mycket som är buskar och plantor. En
  runda är 5 minuter och körs som ett fokuspass (se [MOTORN.md](MOTORN.md)). Tabellen
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
  använder Web Speech API med en svensk röst (`sv-SE`) som finns på enheten,
  aldrig en nätverksröst (se README, Integritet). Frågan läses upp så som
  barn säger den (”3 gånger 7”), och en 🔊-knapp läser upp den igen. Svarstiden
  börjar mätas först när frågan är uppläst, så uppläsningen gör inte barnets
  svarstid längre. Saknas en svensk röst på enheten läses ingenting upp, och det
  står i föräldravyn.

Logiken för båda spelen (`challenge.ts`) är rena funktioner med egna tester.
Spelen sparas som pass med `mode: 'challenge'` respektive `'duel'`, och
tabellövning som `mode: 'focus'`.
