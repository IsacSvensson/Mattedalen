# Plan: klockan och fler stöd (ST och KL)

Två saker i en plan:
- **Barnet lär sig läsa klockan** i en ny plats, Klocktornet.
- **Trädgården får fler stöd för tabellerna:** klockan för femmans tabell,
  fingrarna för nians, hopp på tallinjen, mönster i tabellen och pengar.

Klockan hör till båda. Minutvisaren på 7 är 35 minuter, och det är 7 × 5.

Planen bygger på två underlag om hur barn lär sig klockan i F–åk 3
([KLOCKAN-UNDERLAG](KLOCKAN-UNDERLAG.md) och
[KLOCKAN-UNDERLAG-2](KLOCKAN-UNDERLAG-2.md)). Båda säger samma sak i grunden:
barnet ska inte bara lära sig vad klockan är, utan förstå vad som händer med
tiden.

Tornet ska ge barnet fyra förmågor:
1. **Känna igen:** läsa en tid.
2. **Förstå:** veta varför klockan visar den tiden.
3. **Använda:** räkna ut hur mycket tid som har gått eller är kvar.
4. **Överföra:** växla mellan urtavla, digital tid och ord, och läsa klockan
   hemma.

## Faser

| Fas | Innehåll | Storlek |
|---|---|---|
| ST1. Klockans tabell | Urtavlan med minutvisaren som bild för ×5 och ÷5, regeln för fler bilder i hjälpen, och inställningen ”Bilder i hjälpen”. | Mellan |
| KL1. Urtavlan, visarna och svaren | Urtavlan, visare att ställa och en digital klocka. Skalet får egna svar i stället för knappsatsen, och svarsknappar som kan vara urtavlor. | Mellan |
| KL2. Innehållet, steg 0–5 | Paketet för klockan: dagen, urtavlan, timvisaren, hel och halv, kvart och fem minuter. Felen och felsvaren. | Stor |
| KL3. Passet och hjälpen | Platsens sida och passet. Hjälpen säger vilken visare som är fel. Stöden tas bort ett i taget. | Mellan |
| KL4. Dalen och För vuxna | Tornet på kartan, när det öppnar, sidan i ”För vuxna”, startkollen och kollen. Tornets första släpp. | Stor |
| ST2. Fingrarna för ×9 | Två händer med ett finger nedvikt. | Liten |
| ST3. Räkna i steg | Hopp på tallinjen för alla tabeller. | Liten |
| ST4. Mönster i tabellen | Hundrarutan med tabellens tal, och en rad när svaret bryter mot mönstret. | Liten |
| ST5. Pengar | Mynt som bild för ×2, ×5 och ×10, och på Stigen för tiotal och ental. | Mellan |
| KL5. De svenska fraserna | Fem i och fem över halv, med en frasbyggare. | Mellan |
| KL6. Minuten och dygnet | Varje minut, och 24 timmar. | Mellan |
| KL7. Hur lång tid? | Förfluten tid på en tidslinje. | Mellan |

Ordningen står under [Ordning](#ordning). Varje fas kommer först i
testversionen och släpps när den är provad.

## Varför

- **Klockan är en del av matematiken i åk 1–3.** Kursplanen har ”mätning av …
  tid” under geometri, och appen tränar inget av det i dag ([LGR22](LGR22.md)).
- **Klockan och femmans tabell hör ihop.** Att räkna i femsteg runt urtavlan är
  vanligt i Singapore och England, och kopplas där till femmans tabell.
- **Ett barn tänker olika.** Rektangeln passar inte alla. Fler bilder ger fler
  vägar in, på samma sätt som räknestigen ger flera vägar
  ([PLAN-RAKNESTIG](PLAN-RAKNESTIG.md)).
- **Ett beslut:** en ny plats går emot regeln ”fördjupa före bredda” i
  [färdplanen](FARDPLAN.md#så-prioriterar-vi). Upphovspersonen valde att bygga
  Klocktornet före piloten.

## Del 1. Stöden i trädgården

### En regel för alla bilder

- **Varje fakta har en lista med bilder.** Rektangeln finns alltid med. Sedan
  kommer de stöd som passar faktan: klockan för ×5, fingrarna för ×9, hopp när
  den andra faktorn är högst 5, och mynt för ×2, ×5 och ×10.
- **Bilden byts** mellan gångerna barnet möter faktan. Delat med växlar redan på
  det sättet mellan att bygga och räknestigen.
- **Raden under bilden följer bilden.** Den ersätter den gamla raden. Barnet får
  inte mer att läsa (regeln från E3 i [PLAN-ENKLARE](PLAN-ENKLARE.md)).
- **Räknestigen ändras inte.**
- **”Bilder i hjälpen”** är en ny inställning per barn, på trädgårdens del av
  barnets inställningar. Den har en ruta för vart och ett av stöden klockan,
  fingrarna, hopp och pengar. Alla är påslagna från början. En skola som lär ut
  ett enda sätt kan då stänga av resten.
- **Inställningen följer med** i säkerhetskopian och i QR-koden, med ett
  standardvärde när den saknas. Den kommer inte med i pilotfilen.

### ST1. Klockans tabell

- **Urtavlan** (`src/shell/components/clockFace.ts`) ritas i SVG och delas med
  Klocktornet.
- **I trädgården** visar den bara minutvisaren, med minuterna 5–60 runt kanten.
  Utan timvisare visar bilden ingen tid som kan läsas fel.
- **Minutvisaren hoppar** 5, 10, 15 … fram till svaret, och uppläsningen räknar
  med. Med minskade rörelser står visaren direkt på sin plats.
- **×5:** ”Siffran 7 är 35 minuter. 7 × 5 = 35.” Bilden motverkar ett vanligt
  fel: att läsa siffran under minutvisaren som minuter (”siffran 2 är 2
  minuter”).
- **÷5:** ”35 minuter: minutvisaren står på 7. 35 ÷ 5 = 7.”
- **För vuxna:** tipset för ×5 nämner klockan.

### ST2. Fingrarna för ×9

- **Två händer**, där finger nummer o är nedvikt. Fingrarna före är tiotal, och
  fingrarna efter är ental.
- ”Vik ner finger 4. Före: 3. Efter: 6. 9 × 4 = 36.” Det fungerar hela vägen:
  9 × 10 ger 9 och 0.

### ST3. Räkna i steg

- **Hopp på Stigens tomma tallinje.** `emptyNumberLine` flyttas till
  `src/shell/components`, så att trädgården kan använda den.
- **När den andra faktorn är högst 5.** Fler hopp än så går inte att läsa.
- ”Hoppa 4 i taget: 4, 8, 12. 3 × 4 = 12.”

### ST4. Mönster i tabellen

- **Hundrarutan** markerar tabellens tal. `hundredChart` får ett läge utan
  linjer mellan talen.
- **I början av ”Öva en tabell”** visas tabellens mönster.
- **En rad när svaret bryter mot mönstret**, till exempel ”Femmorna slutar på 0
  eller 5.” efter 34 på 7 × 5. Det finns en sådan rad för ×2 och ×4 (jämna tal),
  ×5, ×10 (slutar på 0) och ×9 (siffrorna blir 9 tillsammans). Raden kommer
  från samma ställe som ”48 är 6 × 8 – nära!” (`confusionNote`).
- **Paketet får inga nya uppgifter.**

### ST5. Pengar

- **Mynt i SVG:** 1, 2, 5 och 10 kronor.
- **I trädgården:** ”7 femkronor är 35 kronor.”
- **På Stigen:** tiokronor och enkronor blir en andra bild för tiotal och ental,
  bredvid stavarna och kuberna.

## Del 2. Klocktornet

### Principer från underlaget

- **Timvisaren rör sig alltid.** Den står där tiden är: vid 3:30 mitt emellan 3
  och 4, aldrig på 3. Timvisaren är det svåraste för barn, och det beror ofta
  på att de lärt sig den som fasta lägen.
- **Visarna följer varandra.** När barnet vrider minutvisaren följer timvisaren
  med, som på en klocka med kugghjul. Visare som rör sig var för sig kommer
  senare, som en utmaning.
- **Digital och analog tid från steg 3**, och översättning åt båda hållen.
  Digital tid väntar inte till åk 3.
- **Mer än flerval.** Barnet ställer visarna, parar ihop analog, digital och
  ord, bygger fraser av brickor och ordnar saker på en tidslinje. Flerval ensamt
  går att gissa.
- **De rätta orden.** Appen säger alltid timvisaren och minutvisaren, inte den
  lilla och den stora. Timvisaren visar vilken timme det är, och minutvisaren
  hur många minuter som har gått.
- **Varje tid i fyra former:** urtavlan, digital tid (07:30), ord (halv åtta)
  och matematik (30 minuter, en halv timme). Barnet möter dem tillsammans från
  början.
- **Förmågorna mäts för sig.** Ett barn kan läsa klockan men inte ställa den,
  eller kunna digital tid men inte urtavlan. Därför är läsa, ställa, digital tid
  och ord olika uppgifter för samma tid, som spegelvända fakta i trädgården.
  ”För vuxna” visar dem var för sig. Barnet går fram efter det det kan, inte
  efter ålder.
- **Sambanden, inte genvägarna.** ”6 betyder halv” får inte bli hela kunskapen.
  Det finns frågor om varför:
  - ”Hur långt är det till 8:00?” vid 7:30;
  - ”Minutvisaren går ett halvt varv. Var står timvisaren nu?”;
  - ”Hur vet du att det är halv?”, med svar att välja bland.
- **Hur barnet tänker, inte bara om svaret är rätt.** När visarna rör sig var
  för sig sparas var barnet ställde båda. Då syns det om barnet matchar
  siffrorna, till exempel ställer timvisaren på 4 vid 4:30.
- **Rörelse och gester.** Handen från kartan visar hur minutvisaren dras när en
  ny tid kommer. Barnet drar själv, och hjälpen visar rätt rörelse.
- **Tidsenheterna.** 60 minuter är en timme, två kvartar är en halvtimme och
  fyra kvartar en timme. Sekunder, dygn och veckor kommer senare.
- **Hjälpen säger vad som är fel.** Den känner igen de kända felen:
  - visarna förväxlade;
  - timvisaren mellan två tal läst som det närmaste talet;
  - siffran läst som minuter;
  - timvisaren rakt på en siffra (”matcha siffrorna”), till exempel på 8 vid
    7:30;
  - spegling kring halv, till exempel ”fem i halv” läst som ”kvart över”;
  - fel timnamn efter :25, eller halv åtta läst som 8:30.

  Till exempel efter 07:06 när minutvisaren står på 6: ”Minutvisaren visar
  minuter. Varje steg mellan siffrorna är fem minuter: fem, tio, femton …”

  Hjälpkortet säger vilken visare som är fel och visar rätt rörelse. Med
  minskade rörelser hoppar visaren i stället för att glida.
- **Felsvaren i flerval kommer från samma fel,** som vid bäcken
  ([PLAN-MINUSTECKNET](PLAN-MINUSTECKNET.md)).
- **Stöden tas bort ett i taget,** efter hur väl tiden sitter: först minuterna
  runt kanten, sedan de färgade fjärdedelarna (½ och ¼ varv) och sist siffrorna.
- **Klockorna ser olika ut:** köksklocka, armbandsur och en stationsklocka utan
  siffror. Då lär sig barnet läsa vilken klocka som helst.
- **Ingen tid och ingen rekordjakt** i tornet. Att läsa klockan är att förstå.
  Det kommer tillbaka med mellanrum, som allt annat i appen.
- **Ut i köket.** Underlagen är oense om det barnet lär sig på skärmen följer
  med till en riktig klocka. En studie från 2020 såg det inte, en från 2021 såg
  det. Tipsen till de vuxna handlar därför om riktiga klockor och barnets egen
  dag, till exempel ”Fråga vid frukosten: vad är klockan?” och ”Hur lång tid
  tar det att borsta tänderna?”. Pilotens test på papper visar hur det går.
- **Ett sätt i taget.** 3:20 är både ”tjugo över tre” och ”tio i halv fyra”.
  Appen säger ”tjugo över” och ”tjugo i” först, och ”tio i halv” kommer sist.
  Båda räknas alltid som rätt, och det andra sättet blir aldrig ett felsvar.
- **Bara svenska.** På engelska är ”half three” 3:30, men ”halv tre” är 2:30.
  Det blandas aldrig.

### Trappan

Delarna följer trappan i det första underlaget
([steg 0–9](KLOCKAN-UNDERLAG.md#5-föreslagen-kompetenstrappa)). Det andra
underlagets trappa har samma ordning, med tidsenheterna och tillämpningen som
egna steg ([steg 1–11](KLOCKAN-UNDERLAG-2.md#9-rekommenderad-progression-för-lärandet)).

| Steg | Vad barnet lär sig | Del | Fas |
|---|---|---|---|
| 0 | Dagen: före och efter, morgon och kväll. Frukost, skola, middag och läggdags på en tidslinje. Hur lång tid saker tar: att borsta tänderna tar några minuter, en skoldag några timmar. Vad som är nära och långt bort: kommer födelsedagen eller sommarlovet först? | `dagen`, i ett eget spår hela vägen | KL2 |
| 1 | Urtavlan: siffrorna 1–12, medurs, timvisaren och minutvisaren och vad de visar. | `urtavlan` | KL2 |
| 2 | Timvisaren ensam: strax efter 3, mitt emellan 3 och 4, strax före 4. | `timvisaren`, i ett eget spår genom steg 3–5 | KL2 |
| 3 | Hel och halv, analog och digital. Halv fyra är 3:30, och timvisaren är halvvägs till 4. | `hel`, `halv` | KL2 |
| 4 | Kvart över och kvart i, som ¼ och ½ varv. En kvart är 15 minuter, två kvartar en halvtimme. | `kvart` | KL2 |
| 5 | Fem minuter i taget, som minuter över. Minutvisaren på 5 är 25 minuter över 3, alltså 3:25. | `femmin` | KL2 |
| 6 | Fem, tio och tjugo över och i. Sedan fem i och fem över halv, när timmen byter namn vid :25. Sist ”tio i halv”. | `fraser`, `halvfraser`, `tioihalv` | KL5 |
| 7 | Minuten, analog och digital. | `minut` | KL6 |
| 8 | 24 timmar, förmiddag och eftermiddag, med ett band för dag och natt. 07:00 och 19:00 ser likadana ut på urtavlan. Sekunder, dygn och veckor. | `dygn`, `enheter` | KL6 |
| 9 | Hur lång tid? Hopp på en tidslinje (+1 h, +30 min, +5 min), också över en hel timme. Vad är klockan om 30 minuter? Lägg till tre kvartar. Hur länge är träningen från 17:30 till 18:30? Med och utan urtavlan. | `hurlange` | KL7 |

### KL1. Urtavlan, visarna och svaren

- **`clockFace`:** timvisaren står alltid där tiden är. Stöden kan slås av ett i
  taget, och urtavlan har flera utseenden.
- **`clockSetter`:** visare att ställa, som följer varandra. Minutvisaren
  snäpper var 30:e, 15:e, 5:e eller 1:a minut, efter vilken del barnet är på.
- **En digital klocka.**
- **Skalet:** en plats kan ha ett eget svar i stället för knappsatsen
  (`SessionPlace.input`). Svaret blir en sträng, till exempel ”3:30”, och
  motorn tar emot den som vilket svar som helst. Svarsknapparna kan vara
  urtavlor (`SessionPlace.choiceView`).

### KL2. Innehållet, steg 0–5

- **Paketet** `src/content/clock`, med delarna i trappan.
- **Formerna**, som egna uppgifter för samma tid:
  - läsa: från urtavlan till digital tid och till ord;
  - ställa: visarna till en tid;
  - para ihop åt båda hållen;
  - förstå: frågor om varför, och hur långt det är till nästa hel timme;
  - ordna dagen och uppskatta hur lång tid saker tar.
- **Läsa klockan är förståelse** (`kind: 'understanding'`): ingen tid räknas.
- **Utseendet** väljs som en variant av uppgiften (`Presentation.variant`).
- **Felen:** en funktion som känner igen dem, och felsvar som bygger på samma
  fel.

### KL3. Passet och hjälpen

- **Platsens sida och passet** går genom samma pass som de andra platserna
  (`runSession`).
- **Ett nytt frö:** barnet ställer visarna med hjälp.
- **Hjälpkortet** säger vilken visare som är fel och visar rätt rörelse.
- **Stöden** tas bort efter hur väl tiden sitter, och utseendet varierar.
- **Uppläsningen** läser tiderna som tider.

### KL4. Dalen och För vuxna

- **Kartan:** tornet står nere till höger under Stigen, där dammen och träden
  står i dag (`SPOTS` i `src/shell/valleyLayout.ts`).
- **Bilden:** ett torn vars urtavla fylls efter det som sitter, enligt
  [designreglerna](TRADGARDEN.md#designregler).
- **Öppningen:** förslaget är att tornet öppnar när de första delarna vid bäcken
  sitter. `femmin` väntar på Stigens tiotal, på samma sätt som tabellerna väntar
  på Stigen. En vuxen kan öppna tornet i förväg.
- **Dagens plan:** högst två platser av fyra. Vi kontrollerar att tornet inte
  tränger undan bäcken för ett ungt barn.
- **QR-koden** ska fortfarande rymmas i en kod med fyra platser.
- **För vuxna:** platsens sida, där timvisaren och minutvisaren står var för
  sig. Där finns förväxlingarna, tips om riktiga klockor och ”Vad betyder
  bilderna?” för tornet.
- **Startkollen** hoppar över steg som barnet redan kan. Barn börjar skolan med
  olika kunskap om klockan, och inte alltid i samma ordning. **Kollen** följer
  över tid. Båda byggs som NCM:s Diamantdiagnoser för mätning av tid: analog tid
  (läsa, ställa, enheterna), tidsskillnad och från analog till digital tid.
- **Dokumenten:**
  - README;
  - LGR22, där ”mätning av … tid” nu tränas delvis, och ½ och ¼ som delar av
    ett varv;
  - en nyhet i ”Nytt i Mattedalen”.
- **Piloten** får ett test på papper och med en riktig klocka, före och efter.

### KL5. De svenska fraserna

- **En frasbyggare** med brickor: [fem] [i] [halv] [fyra].
- **De fyra besluten** blir synliga ett i taget:
  1. utgångspunkten: hel eller halv;
  2. riktningen: i eller över;
  3. avståndet: 5, 10 eller 15;
  4. timnamnet: den här timmen eller nästa.
- **Hjälpen** visar speglingen kring halv.

### KL6. Minuten och dygnet

- **Varje minut,** analog och digital.
- **24 timmar,** med förmiddag och eftermiddag: 15:25 är fem i halv fyra på
  eftermiddagen.

### KL7. Hur lång tid?

- **En tidslinje med hopp** av 1 timme, 30 minuter och 5 minuter.
- **”Hur länge till …?”** i vardagen, också över en hel timme.
- **Aldrig som en uppställning.** Då blir 4:40 + 30 lätt 4:70.

### Kanske senare

- **”Känn en minut”:** ett timglas eller en stapel som fylls under en minut.
  Barnet svarar inte på tid, så det är ingen tidspress.

## Ordning

1. **ST1 först**, eftersom urtavlan behövs i Klocktornet.
2. **KL1–KL4**, tornets första släpp.
3. **ST2–ST5**, en i taget.
4. **KL5–KL7.**

Ordningen kan ändras. Varje fas rapporteras innan nästa börjar.

## Fallgropar

- **Timvisaren får aldrig stå på en siffra vid halv.** Det gäller också bilden
  för ×5 i trädgården, och den visar därför bara minutvisaren.
- **Två sätt att säga 3:20 och 3:40.** Det andra sättet får aldrig bli ett
  felsvar.
- **Timmen vid halv och i:** halv ett är 12:30, och kvart i ett är 12:45.
  Enhetstester täcker alla minutlägen.
- **Uppläsningen** gör ”: ” till en paus (`spokenText`). ”3:30” har inget
  mellanslag efter kolon och ska läsas som en tid. Det behöver ett test.
- **Fler bilder får inte bli mer text.** Varje bild har en rad, som ersätter den
  gamla.
- **Fingrarna är omdiskuterade** i en del skolor. Därför finns en ruta för att
  stänga av dem.
- **En ny inställning eller plats** måste följa med i QR-koden, i säkerhetskopian
  och i pilotfilen, eller lämnas utanför med avsikt.
- **Underlagen är tunna för appar,** och oense om det barnet lär sig på
  skärmen följer med till en riktig klocka. Därför finns tipsen om riktiga
  klockor och pilotens test på papper.
- **Läsa klockan är inte att förstå tiden.** Ett barn som läser 07:45 vet inte
  säkert hur långt det är till 08:00. Därför finns frågorna om varför och om hur
  lång tid, redan i KL2.

## Verifiering

- **Varje fas:** typkontroll, enhetstester, bygge och hela e2e-sviten.
- **Skärmbilder** på 320 och 360 px och på surfplatta, utan sidledsscroll.
- **ST1:** ett enhetstest för bildlistan, och ett e2e-test för att ×5 visar
  klockan varannan gång och att inställningen stänger av den.
- **KL1:** visarnas vinklar under alla 720 minuterna.
- **KL2:** en tabell med alla tider och deras fraser, och att varje felsvar är
  ett av de kända felen.
