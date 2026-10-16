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
