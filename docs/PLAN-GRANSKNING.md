# Plan: efter granskningen av konceptet

Konceptdokumentet ”Mattedalen – design och koncept för granskning” granskades i
oktober 2026. Den här planen samlar det vi gör av granskningen, i den ordning vi
gör det. Fynden från varje fas skrivs in här.

## Vad granskningen sa, kort

- **Siffror på barnens sidor** (”28 av 30”, räknarna under trädgården) är poäng i
  allt utom namnet. Det är den största svagheten.
- **Dalen** kan bli en svepbar värld med en scen per plats, i stället för en karta
  där platserna är små symboler.
- **Hjälpkortet** ”Man kan inte ta 6 från 2” blir fel när negativa tal kommer.
- **×5** behöver inte vänta på Stigen.
- **Taket** för väntan bör räknas i speldagar, inte i veckor.
- **En vuxen** ska kunna stänga av väntan helt.
- **Väntedatumen** bör följa med i QR-koden och säkerhetskopian.
- **Simuleringen** bör köras med fler slumpfrön och redovisa svag, genomsnittlig
  och stark elev var för sig.
- **75 − 23** som en egen del på Stigen, och en loggexport inför piloten.

## Våra bedömningar

- **Taket räknas i speldagar i hela dalen,** inte bara på Stigen. Stigen kan vara
  stängd, och då skulle ett barn aldrig få några speldagar där.
- **Delat med syns redan på samma planta** (blommor, kart och frukt på busken).
  Om kart behövs avgörs i piloten.
- **Bygget med stavar och kuber** har redan tryck som huvudsätt; att dra är ett
  extra sätt.
- **Regeln om sidled** skrivs om när dalen blir svepbar: sidan rullar inte, men
  världen panoreras inuti en egen behållare.

## Faser

| Fas | Innehåll |
|---|---|
| R1. Snabba rättelser | Siffrorna bort från barnens sidor. Nya ord på hjälpkortet. ×5 slutar vänta. Taket i speldagar. En vuxen kan stänga av väntan. Väntedatumen i QR-koden och säkerhetskopian. |
| R2. Simuleringen igen | Fler slumpfrön, och svag, genomsnittlig och stark elev var för sig. Siffrorna i dokumenten uppdateras. |
| H6. Verifiering | Stigen och R1: genomgång av hela flödet, skärmbilder i alla storlekar, dokumenten. |
| R3. Dalen som svepbar värld | En egen plan med skärmbilder, sedan bygget. |
| R4. Tvåsiffrigt minus tvåsiffrigt | En egen del på Stigen. |
| R5. Inför piloten | Loggexport som den vuxna väljer att skicka. Trädgårdens former som fråga till piloten. |

## Fynd från R1

- **Siffrorna är borta från barnens sidor.** Vid bäcken och på stigen står en rad
  om vad barnet är på nu, till exempel ”Nu: Över tiotalet”. Bron och lyktorna
  visar resten. Trädgården har inga räknare under lådan. En skärmläsare får i
  stället en mening, till exempel ”I lådan växer frön, plantor och buskar, med
  blommor.”
- **Slutskärmarna** säger vad som hände, utan antal: ”Nya stenar”, ”Lyktorna
  lyser lite mer”, ”Plantor växte”.
- **Hjälpkortet** säger nu ”2 räcker inte till 6. Gå ner till 50 först.” Samma
  form vid bäcken: ”3 räcker inte till 5. Gå ner till 10 först.”
- **×5 väntar inte** på Stigen. Den kommer efter ×10 som förut. Ett barn som kan
  ×5 räknas ändå som att det kan halvera, så ×4 väntar inte för det barnet.
- **Taket är 14 speldagar** (`WAIT_PLAY_DAYS`). En speldag är en dag med minst
  ett svar någonstans i dalen. Startkollen och kollen räknas inte.
- **En vuxen kan stänga av väntan** i föräldravyn, under Trädgården, Inställning.
- **Väntedatumen** ligger nu i barnets profil. De följer med i säkerhetskopian och
  i QR-koden, som en valfri del sist. Äldre koder och säkerhetskopior läses som
  förut. Datum som sparats på det gamla sättet läses och flyttas in i profilen.
  En äldre version av appen kan inte läsa en QR-kod med väntedatum, så båda
  enheterna behöver vara uppdaterade.
- **Simuleringen med ett frö** (R2 kör fler): ett genomsnittligt barn har 86 % av
  gångerfakta som sitter efter ett år med Stigen, mot 90 % utan Stigen och 66 %
  med väntan utan tak. Ett starkt barn har allt efter ett år.

## Fynd från R2

Dalen kördes med tio slumpfrön per elev i ett år
(`tests/simulation/valleyReport.test.ts`). Varje siffra är medianen, med det
lägsta och högsta värdet inom parentes. Fyra fall jämfördes: utan Stigen, med
Stigen men ingen väntan, som i appen, och med väntan utan tak.

**Ett fel i regeln hittades.** Stigen öppnar först när barnet kan gå över
tiotalet vid bäcken, för ett genomsnittligt barn vecka 17. Men ×10, ×4 och ×3
kan öppna redan vecka 10–14. De väntade alltså på en plats som barnet inte kunde
gå till, och taket släppte 64 av 68 tabeller. Väntan var bara en fördröjning.
**Nu väntar tabellerna bara när Stigen är öppen.** Då släpper taket 16 av 68
tabeller, och resten öppnar när delen sitter eller utan väntan.

Gångerfakta som sitter:

| Elev | Vecka | Utan Stigen | Ingen väntan | Som i appen | Väntan utan tak |
|---|---|---|---|---|---|
| Genomsnittlig | 26 | 84 % (81–90) | 74 % (38–80) | 75 % (33–84) | 76 % (32–84) |
| Genomsnittlig | 52 | 90 % (86–95) | 86 % (67–88) | 84 % (77–90) | 78 % (63–90) |
| Stark | 26 | 100 % | 97 % (93–100) | 97 % (96–99) | 97 % (93–99) |
| Stark | 52 | 100 % | 100 % | 100 % | 99 % |
| Svag | 52 | 1 % (0–11) | 1 % | 1 % | 1 % |

- **Den tredje platsen kostar mer än väntan.** För ett genomsnittligt barn går
  det från 90 % till 86 % när dagen delas på tre platser, och till 84 % med
  väntan. Efter ett halvår är skillnaden större: 84 % mot 75 %.
- **Ett frö kan lura.** Mellan frön skiljer det upp till 50 procentenheter efter
  ett halvår. Siffrorna i H5 kom från ett frö.
- **Ett starkt barn** får alla tabeller inom 15 veckor, några veckor senare
  med Stigen. Taket släpper 41 av 70 tabeller, eftersom tabellerna kan öppna
  snabbare än Stigens delar sitter. Utan tak skulle ×3, kvadrattalen och ×7 och
  ×8 vänta ungefär tio veckor till.
- **Ett svagt barn är vid bäcken nästan hela året.** Dubblorna sitter vecka 38
  (26–51), och då öppnar trädgården. Över tiotalet sitter inte inom ett år, så
  Stigen öppnar aldrig. Väntan spelar ingen roll för det barnet.
- **Rätt svar:** 81 % för ett genomsnittligt barn med Stigen, mot 85 % utan.
  Stigens uppgifter är svårare i modellen, som inte vet att 40 + 30 bygger på
  4 + 3. Ett starkt barn har 92 %, ett svagt 78 %.

**Frågor till piloten:**

- Ska trädgården öppna tidigare för ett barn som kan dubblorna säkert men
  långsamt? I dag krävs att de sitter, och det räknar med tid. En vuxen kan
  redan öppna den.
- Är Stigen värd en tredjedel av dagen för ett genomsnittligt barn, när den kostar
  ungefär fyra procentenheter av gångerfakta efter ett år? Svaret beror på vad
  barnet vinner i talen till 100, och det mäter Stigens koll.
