# Plan: plus först vid bäcken (C)

Ett barn som inte har mött minustecknet ska få plus först. Minus kommer när
plus sitter, och första gången med ett kort som visar att minus betyder att ta
bort.

## Varför

- **Minus från första frågan.** Bäcken lägger en hel familj i samma del: 8 + 5,
  5 + 8, 13 − 5 och 13 − 8. Ett nytt barn kan få 2 − 1 som andra eller tredje
  fakta. Det fungerar för en 7–9-åring som har mött minus i skolan.
- **En 6-åring räknade plus på minus** ([PLAN-MINUSTECKNET](PLAN-MINUSTECKNET.md)).
  MA visar det för den vuxna, och MB tog bort gissningarna bland alternativen.
  Men appen lär fortfarande inte ut vad minus betyder.
- **Delat med gör redan så.** En division kommer först när båda gångerfakta i
  familjen sitter (`requires` i `division.ts`). Minus kan vänta på plus på samma
  sätt. Motorn har stödet; bara innehållet ändras.

## Hur

### Minus väntar på plus

- **Varje minusfakta får familjens plusfakta som krav** (`requires`):
  13 − 5 och 13 − 8 kommer när 8 + 5 och 5 + 8 sitter. I en dubbelfamilj finns
  bara en plusfakta (4 + 4 före 8 − 4).
- **Ingenting annat i ordningen ändras.** Delarna, deras ordning och när de
  öppnas är desamma. Inom en del kommer plus först, och minus fylls på när plus
  sitter.
- **Det gäller alla barn,** inte en inställning. Ett barn som kan plus märker
  det knappt: plus sitter snabbt, eller redan efter startkollen, och då kommer
  minus som förut.
- **Barn som redan har börjat:** minusfakta som redan är igång fortsätter. Bara
  nya minusfakta väntar på sin plusfamilj.
- **QR-koden och sparade framsteg** ändras inte. Inga fakta byter plats eller id.

### Första minus: ett kort som visar ta bort

- **Första gången ett barn får en minusfakta** kommer ett eget introkort före den
  vanliga: ”Minus betyder att ta bort.” Det visar ett litet tal, till exempel
  4 − 1: fyra stenar, och en hoppar bort. Sedan hoppet bakåt på tallinjen.
  Kortet läses upp om uppläsningen är på.
- **Det visas en gång per barn,** när den första minusfaktan introduceras. Det
  behövs ingen ny data: det är första gången om barnet inte har någon minusfakta
  igång.

### Hjälpen efter plus på minus

- **Hjälpkortet** säger i dag ”3 är 2 + 1. Här ska det vara minus.” Det blir:
  ”3 är 2 + 1. Minus betyder att ta bort: 2, ta bort 1.” Bilden med hoppet bakåt
  finns redan på kortet.

## Faser

| Fas | Innehåll |
|---|---|
| C1. Minus väntar på plus | Kraven på minusfakta. Enhetstester. Simulering före och efter. |
| C2. Det barnet ser | Kortet för första minus och den nya hjälptexten. E2e, skärmbilder och dokumenten. |

### Simuleringen i C1

Bäckens och dalens simulering, med åtta frön och tre elever (genomsnittlig,
svag och långsam), före och efter:

- vecka när Trädgården öppnar (dubblorna sitter) och när Stigen öppnar (över
  tiotalet sitter);
- andel minusfakta som sitter efter 8 och 26 veckor;
- hur många minusfakta som väntar på sin plusfamilj, vecka för vecka.

Simuleringen kan visa vad det kostar i tid. Den kan inte visa nyttan, eftersom
den simulerade eleven inte blandar ihop plus och minus. Nyttan syns först hos
riktiga barn.

## Beslut som behövs

1. **Båda plusfakta eller bara en?** Planen säger båda, som delat med. Bara den
   första (8 + 5) gör att minus kommer tidigare. Simuleringen i C1 visar
   skillnaden, och sedan väljer vi.
2. **Alla barn eller bara nybörjare?** Planen säger alla, eftersom det knappt
   märks för barn som kan plus. Alternativet är att det bara gäller barn som
   valde ”Börja från början” vid startkollen.

## Fallgropar

- **Långsamma barn.** En plusfakta sitter först när barnet svarar snabbt nog
  (buske). Ett barn som räknar rätt men långsamt kan vänta länge på minus. ”Ge
  mer tid” hjälper, och simuleringen med den långsamma eleven visar hur länge.
- **Delarna öppnas efter 80 %.** Om minus kommer senare tar det längre tid innan
  en del når 80 %, och då öppnas nästa del senare. Det är det simuleringen ska
  mäta.
- **E2e-tester** som räknar med en minusfakta tidigt vid bäcken kan behöva ändras.
- **Mönstret från MA finns kvar.** Det fångar barn som redan har minus igång,
  och barn där kortet inte räckte.
