# Plan: tvåsiffrigt minus tvåsiffrigt (R4)

En nionde del på Stigen: 75 − 23, 72 − 38 och 71 − 68. Den kommer efter
”Tvåsiffrigt plus tvåsiffrigt” och får en lykta på stolpen vid 100.

## Varför

- **Det saknas.** Stigen har plus och minus över tiotalet och tvåsiffrigt plus,
  men inget tvåsiffrigt minus (första granskningen, [PLAN-GRANSKNING](PLAN-GRANSKNING.md#faser)).
- **Kursplanen** för åk 1–3 tar upp subtraktion med huvudräkning inom talområdet
  0–200. Två sätt att tänka hör dit: att ta bort och att räkna upp (skillnad).

## Hur

- **Delen ”Tvåsiffrigt minus tvåsiffrigt”** (`tvasiffrminus`). Den öppnar när
  tvåsiffrigt plus sitter. Det är samma hopp på tio, fast bakåt.
- **Tre sorters uppgifter, i den här ordningen:**
  1. **Utan att gå över tiotalet:** 75 − 23, 68 − 25, 89 − 34, 57 − 32, 96 − 41.
     Ta bort tiotalen, sedan entalen: 75 − 20 = 55, 55 − 3 = 52.
  2. **Över tiotalet:** 72 − 38, 63 − 27, 81 − 46, 54 − 29, 45 − 18, 90 − 36.
     72 − 30 = 42, 42 − 8 = 34, med steget ner till tiotalet: 42 − 2 = 40,
     40 − 6 = 34.
  3. **Tal nära varandra: räkna upp.** 71 − 68, 52 − 47, 83 − 79, 64 − 58. Från
     68 till 70 är 2, och till 71 är 1 till: 3. Att ta bort 68 vore en lång väg.
- **Tallinjen** visar hoppen bakåt (75 → 55 → 52), eller uppåt från det mindre
  talet (68 → 70 → 71) med hoppens storlek (+2, +1).
- **Räknestigen** börjar i ett steg: det första hoppet bakåt (75 − 20) eller upp
  till tiotalet (68 + __ = 70). De stegen hör till den nya delen och kommer först
  i den. Ett steg som en tidigare del redan har stannar där (47 + __ = 50).
- **Förväxlingen** ”minsta från största” får en egen förklaring: 72 − 38 = 46
  kommer av 8 − 2 i stället för 2 − 8. ”Här går det inte att ta 8 från 2. Gå
  över tiotalet: 72 − 30 = 42, 42 − 8 = 34.”
- **Stigens koll** får en kategori ”Tvåsiffrigt minus”.
- **QR-koden och sparade framsteg:** de nya uppgifterna läggs sist, och paketets
  version blir 2. En äldre kod läses som förut, och det nya börjar från början.
- **Den nionde lyktan** hänger på stolpen vid 100.

## Faser

| Fas | Innehåll |
|---|---|
| R4a. Innehållet **(klar)** | Delen, uppgifterna, stegen, strategierna, tallinjen, räknestigen, förväxlingen, kollen, lyktan, version 2. Enhetstester. |
| R4b. Simulering och verifiering | Dalen simulerad med den nya delen: när den öppnar och sitter. E2e, skärmbilder och dokumenten. |

## Fallgropar

- **Gamla framsteg.** En nionde del får inte flytta något barn bakåt, eller låta
  delar öppna som inte ska. De nya uppgifterna är nya för alla.
- **Räkna upp är inte alltid bäst.** Bara när talen ligger nära varandra (högst
  10 isär). Annars blir det många små hopp.
- **Lyktorna** räknas på flera ställen (kartan, stigens sida, föräldravyn). Alla
  ska få nio.

## Fynd från R4a

- **29 nya uppgifter,** sist i paketet: 11 första hopp bakåt och 3 steg upp till
  tiotalet, 11 uppgifter att ta bort och 4 att räkna upp. Paketet har 253
  uppgifter i version 2. De 224 från version 1 har kvar sina platser, så att en
  äldre QR-kod läses som förut.
- **Stegen hör till den nya delen.** Hade 75 − 20 lagts i ”Hoppa tio” skulle den
  delens andel som sitter sjunka för barn som redan har den. Nu ändras inga gamla
  delar. Uppgiften visas ändå som det den är: hopp på tio, med hundrarutan och
  samma felsvar som i ”Hoppa tio”.
- **Den öppnar när tvåsiffrigt plus sitter.** Först öppnade den samtidigt. Då
  trängdes delarna, och tvåsiffrigt plus satt sämre efter ett halvår.
- **Den är svårast på stigen.** I Stigens egen simulering, med åtta frön under
  ett halvår, svarar ett genomsnittligt barn rätt på 78 % mot 79,5 % utan den.
  Tvåsiffrigt plus sitter till 74 % mot 76 %, och det skiljer 42–92 % mellan
  frön. Testernas gränser är sänkta med det som skäl.
- **Felsvaren:** 72 − 38 = 46 (minsta från största), 75 − 23 = 72 (tiotalen
  glömda) och ett tiotal fel. Varje felsvar har en egen förklaring.
- **Kollen** har två uppgifter till, sist, så att de andra sorterna dras som förut.
- **Den nionde lyktan** hänger på stolpen vid 100.
