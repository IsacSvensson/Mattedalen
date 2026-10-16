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
| R1. Snabba rättelser **(klar)** | Siffrorna bort från barnens sidor. Nya ord på hjälpkortet. ×5 slutar vänta. Taket i speldagar. En vuxen kan stänga av väntan. Väntedatumen i QR-koden och säkerhetskopian. |
| R2. Simuleringen igen **(klar)** | Fler slumpfrön, och svag, genomsnittlig och stark elev var för sig. Siffrorna i dokumenten uppdateras. |
| H6. Verifiering **(klar)** | Stigen och R1: genomgång av hela flödet, skärmbilder i alla storlekar, dokumenten. |
| R3. Dalen som svepbar värld | Plan och attrapp i [PLAN-DALEN.md](PLAN-DALEN.md), sedan bygget. |
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

## Fynd från H6

Hela flödet på Stigen gicks igenom i fem storlekar: 320 och 360 px bred
telefon, liggande telefon (800 × 360), surfplatta (1080 × 810) och dator
(1920 × 1040). Det gällde 17 skärmar, från kartan där Stigen vilar till
föräldravyn. Ingen skärm går att rulla i sidled.

Två saker rättades:

- **Liggande telefon:** ”30 + 30 = ?” bröts så att frågetecknet hamnade på en
  egen rad bredvid sifferknapparna. Frågan är nu lite mindre där och får plats
  på en rad.
- **Sättet att tänka** bröts mitt i ett led på smal telefon (”… = 20 +” och
  ”4 = 24.” på nästa rad). Nu bryts raden bara vid likhetstecknen, på alla
  platser och i föräldravyn.


## Andra granskningen: progression, stöd och kursplan

En andra granskning kom i oktober 2026. Den gällde växternas betydelse, stöd,
svarstid och kopplingen till Lgr22. Här står vad den sa, vad koden visar och
vad vi föreslår.

| Påstående | Vad koden visar | Förslag |
|---|---|---|
| Ett fel får inte radera tidigare lärande. | **Stämmer, och är ett fel.** En flytande fakta som besvaras fel blir ”övas” i låda 0, och då ritas den som ett frö. Busken hoppar alltså över grodden. Träd blir buske, som det ska. | Ett fel tar växten ett steg ner, aldrig två: buske blir grodd. Ett frö är bara en fakta som aldrig har varit flytande. Alla sex övergångar får en regel och ett test. |
| Skilj självständiga svar från svar med stöd. | **Finns i kunskapsmodellen.** Ett svar via räknestigen ger ingen evidens. Rätt efter fel samma dag räknas inte. Automatiserad kräver fritt svar. **Saknas i föräldravyn:** statistiken räknar svar via räknestigen som vanliga rätt. | Föräldravyn visar svar med stöd för sig. |
| Svarstid ska vara en indikator, inte ensam avgöra. | **Delvis.** Tiden avgör aldrig ensam, eftersom det krävs rätt svar på flera dagar. Men en buske kräver svar under 5 s två dagar, så ett barn som svarar rätt och långsamt stannar vid grodden. Det hänger ihop med R2:s fynd om den svaga eleven. | Pröva i simuleringen att busken bara kräver rätta, självständiga svar på olika dagar, och att tiden bara gäller trädet (automatiserad). Det berör också när trädgården öppnar. |
| Härled okända fakta ur kända. | **Finns.** Räknestigarna bygger på kända fakta, till exempel 7 × 8 som dubbla 7 × 4 och 9 × 7 som 70 − 7. **Saknas:** stigen är fast per fakta, och väljs inte efter vad barnet redan kan. | Låt räknestigen välja bland flera vägar efter det barnet kan (7 × 8 via 7 × 4, eller via 5 × 8 + 2 × 8). |
| Fakta ska återkomma efter stöd. | **Finns.** Efter ett fel kommer faktan tillbaka senare i passet och nästa dag. Kollen ungefär var sjunde speldag mäter utan stöd. | Inget nytt. |
| Spara progressionen om barnet avbryter. | **Finns.** Varje svar sparas direkt. | Inget nytt. |
| Tillämpning i vardagsnära problem. | **Delvis.** Lika stora grupper och Dela lika är uppgifter i ord och bild. | Ett litet antal vardagsproblem i trädgården, senare. |
| Beskriv appen som ett komplement, inte hela kursplanen F–3. | Dokumenten säger att kopplingen till Lgr22 ska stämmas av, men inte vad appen inte täcker. | En kort text i README om vad appen tränar och inte tränar. Stämma av mot Skolverkets text när webbplatsen kan nås härifrån. |
| Fördjupa i stället för att bredda. | Ordningen framåt nämner Dammen och Bikupan. | Vänta med nya platser tills piloten visar att progressionen fungerar. |
| Validera med riktiga barn. | Piloten är planerad, med loggexport i R5. | Lägg till granskningens frågor till barnen i piloten: förstår de växterna, vad som ändras och hur man får hjälp. |

### Föreslagna faser

| Fas | Innehåll |
|---|---|
| S1. Växternas övergångar | Ett fel tar ett steg ner, aldrig två. Regler och tester för alla sex övergångar. Samma kontroll för bron och lyktorna. Föräldravyn visar svar med stöd för sig. |
| S2. Tid och långsamma barn | Simulera busken utan tidskrav, och tiden bara för trädet. Svag, genomsnittlig och stark elev, med tio frön. Beslut efter siffrorna. |
| S3. Räknestig efter det barnet kan | Flera vägar per svår fakta. Stigen väljs efter vad barnet redan kan. |
| S4. Appens syfte i dokumenten | Vad appen tränar och inte tränar. Stämma av mot Lgr22. |

S1 är ett fel i det barnet ser, och liten. Förslaget är att göra S1 före R3, och
S2–S4 efter R3.

## Fynd från S1

- **Felet är rättat.** En buske som besvaras fel blir en planta, inte ett frö.
  Motorn minns det högsta läget en fakta nått (`peak`). En fakta som en gång varit
  buske blir aldrig frö igen. Alla sex övergångar står i
  [TRADGARDEN.md](TRADGARDEN.md#designregler) och har tester.
- **Föräldravyn hade samma fel:** värmekartan visade en fakta som fallit som ny.
  Nu visas den som övas.
- **QR-koden** skickar en fakta som fallit från flytande som en som övas, så den
  blir en planta på den nya enheten.
- **Bron och lyktorna** räknar andelen fakta som sitter. Ett fel flyttar dem
  redan bara en fakta, så där behövdes ingen ändring.
- **Svar med stöd:** föräldravyns detaljer för en fakta räknar nu svar via
  räknestigen för sig, till exempel ”2 försök, 50 % rätt · 2 gånger via
  räknestigen”. Äldre sammanfattad historik skiljer inte på dem.

