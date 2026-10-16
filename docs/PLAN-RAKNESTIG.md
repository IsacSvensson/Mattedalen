# Plan: räknestig efter det barnet kan (S3)

En svår gångerfakta kan nås på flera vägar. Räknestigen tar den väg där barnet
redan kan stegen, i stället för samma väg för alla.

## Varför

- **Stigen är fast per fakta.** 7 × 8 går alltid via dubbla 4 × 7. Ett barn som
  kan 5 × 8 och 2 × 8 men inte 4 × 7 får ingen räknestig alls, fast det kunde
  ha tagit sig dit (andra granskningen, [PLAN-GRANSKNING](PLAN-GRANSKNING.md#andra-granskningen-progression-stöd-och-kursplan)).
- **Att välja väg är en del av att kunna.** Forskningen om härledda fakta
  (derived facts) säger att flexibla vägar från kända fakta är steget före att
  minnas. Barnet ska se att 7 × 8 kan byggas av det det redan har.
- **Hjälpen ska vara barnets.** Raden under ett nytt frö och efter ett fel visar
  samma väg för alla. Den kan peka på fakta barnet inte kan än.

## Hur

- **Varje svår fakta får flera vägar** (`strategiesFor` i
  `content/multiplication/facts.ts`). Först tabellens egen väg, som i dag.
  Sedan den andra faktorns väg, och några till:
  - ×3: två grupper och en till (2 × o + o).
  - ×4: dubbla 2 × o, eller fem grupper minus en (5 × o − o).
  - ×6: fem grupper och en till, eller dubbla 3 × o.
  - ×7: fem grupper och två grupper (5 × o + 2 × o).
  - ×8: dubbla 4 × o, eller fem grupper och tre grupper.
  - ×9: tio grupper minus en.
  - Kvadrattalen som i dag, och samma regler för den andra faktorn.
- **Motorn väljer vägen** (`Item.paths`, `Question.from`). Bland vägarna där
  alla steg är minst flytande tar den den starkaste: där det svagaste steget har
  högst status, sedan högst låda. Lika bra vägar: tabellens egen först. Finns
  ingen sådan väg blir det ingen räknestig, som i dag.
- **Räknestigen, rektangeln och raden** följer den valda vägen. Rektangeln delas
  där vägen delar den: 7 × 8 som 5 och 2 rader, eller som två lika halvor.
- **Ett nytt frö och hjälpen efter ett fel** visar också den väg barnet kan bäst.
  Kan barnet ingen väg än visas tabellens egen.
- **Föräldravyn** visar vägen som barnet får för de svåra fakta.
- **Bäcken och Stigen** ändras inte. Där finns en naturlig väg per uppgift (över
  tiotalet, via tiotalet), och de vägarna bygger på barnets egna steg redan.
- **Delat med** ändras inte heller. Där räknar räknestigen grupper från 2, 5
  eller 10, och det är samma för alla.

## Faser

| Fas | Innehåll |
|---|---|
| S3a. Vägarna och valet **(klar)** | Flera vägar per fakta, motorn väljer, räknestigen, rektangeln och raden följer vägen. Enhetstester. |
| S3b. Föräldravyn och simuleringen **(klar)** | Svåra just nu visar barnets väg. Simuleringen mäter hur ofta en räknestig kan ges, före och efter. |
| S3c. Verifiering | E2e för ett barn som kan 5 × 8 och 2 × 8 men inte 4 × 7, skärmbilder, dokumenten. |

## Fallgropar

- **Vägen får inte ge bort svaret.** Ett steg som ”7 × 8 = …” före sista steget
  vore fusk. Vägarna börjar alltid i en annan fakta.
- **Steget måste vara lättare.** Bara fakta som barnet lär sig i en tidigare
  del räknas som steg, som för tabellens egen väg i dag. 4 × 8 kan alltså inte
  gå via 4 × 4, som hör till samma del.
- **Samma väg flera dagar.** Vägen ändras bara när barnet kan något nytt. Det
  ger lugn för ett barn som har svårt, och flexibilitet över tid.

## Fynd från S3a

- **Två till fyra vägar per svår fakta.** 7 × 8 har tre: dubbla 7 × 4,
  7 × 5 + 7 × 3 och 5 × 8 + 2 × 8. 6 × 8 har fyra. ×1, ×2 och ×10 har ingen,
  som förut.
- **Kvadrattalen** delas bara på ett håll. Annars blev samma väg två gånger,
  spegelvänd.
- **Steget måste komma från en tidigare del.** Det tog bort några vägar som såg
  rimliga ut, till exempel 4 × 8 som dubbla 4 × 4 och 5 × 7 som 5 × 5 + 5 × 2.
- **Vägen följer med varje fråga,** inte bara räknestigen. Raden under ett nytt
  frö visar alltså vägen barnet kan, till exempel ”7 × 8 = 5 × 8 + 2 × 8” för ett
  barn som kan 5 × 8 och 2 × 8 men inte 7 × 4 eller 7 × 3.
- **Ett barn som kan alla vägar** får tabellens egen, så länge den är lika stark.
  Vägen ändras först när en annan väg blir starkare.

## Fynd från S3b

- **Föräldravyn** visar under ”Svåra just nu” den väg barnet får, till exempel
  ”7 × 8 = 56 – 7 × 8 = 5 × 8 + 2 × 8 = 40 + 16 = 56”. Kan barnet ingen väg än
  visas tabellens egen.
- **Simuleringen** (`tests/simulation/raknestigReport.test.ts`) kör dalen ett år
  med tio slumpfrön, med en väg per fakta och med flera. Barnet är detsamma, bara
  hjälpen skiljer. Det långsamma barnet har ”Ge mer tid”.

Andelen svåra fakta i trädgården där spelet inte kan ge någon räknestig, summerat
över alla veckor (median):

| Elev | En väg | Flera vägar | Varav: barnet kan inte stegen än, en väg → flera |
|---|---|---|---|
| Genomsnittlig | 44 % | 35 % | 9 % → 6 % |
| Långsam | 66 % | 63 % | 10 % → 7 % |
| Stark | 29 % | 28 % | 0 % → 0 % |
| Svag | 99 % | 99 % | 0 % → 0 % |

- **Där barnet inte kan stegen än** blir det ungefär en tredjedel färre fall.
  Det var det S3 skulle lösa.
- **Det mesta som saknar räknestig är fakta utan väg,** framför allt ×2 och ×10.
  Det svaga barnet är i trädgården sent, och där är nästan alla svåra fakta ×2.
  En sådan fakta har ingen tidigare gångerfakta att bygga på. Men ×2 är dubblorna
  från bäcken (7 × 2 = 7 + 7), och ×10 är tiotal från Stigen. En väg över
  platsernas gränser är ett förslag till senare.
- **Antalet räknestigar** ändras nästan inte (499 mot 507 på ett år för ett
  genomsnittligt barn). Taket är tre per pass och en per fakta och dag, och det
  nås redan. Andelen gångerfakta som sitter ändras inte heller.
