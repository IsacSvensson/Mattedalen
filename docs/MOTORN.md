# Faktamotorn

Motorn i `src/engine` bär alla platser i Mattedalen som tränar fakta. Den kommer
från Gångerträdgården och används som den är. Trädgården (multiplikation) är den
första platsen som använder den, se [TRADGARDEN.md](TRADGARDEN.md).

När Bäcken byggs blir kunskapskomponenter med en graf över förkunskaper kärnan,
och en fakta (`Item`) blir en kunskapskomponent av typen fakta. Se ordningen i
[OVERLAMNING-MATTEDALEN.md](OVERLAMNING-MATTEDALEN.md).

## Motorn (`src/engine`)

Motorn är ren och deterministisk:

- **Inga DOM- eller lagringsberoenden.** Den kompileras med en egen tsconfig utan
  DOM-typer (`tsconfig.engine.json`). Ett test kontrollerar dessutom att den bara
  importerar egna moduler och inte nämner multiplikation.
- **Klocka och slump injiceras** (`Clock`, `Rng`). Tester och simuleringar använder
  `ManualClock` och `seededRng`.
- **Ändrar inget tillstånd.** Varje svar ger en ny `ItemState` och ett `Attempt`
  som spelet själv sparar.

```ts
const engine = createEngine({ pack, clock, rng });
const session = engine.startSession({ states, meta });   // mode: 'daily' | 'extra' | 'focus'
for (let q = session.next(); q; q = session.next()) {
  // q.kind: warmup | new | rehearse | retry | due | mixed
  // q.format: 'choice' (med q.choices) eller 'free'
  const fb = session.submit(svar, svarstidMs);           // { correct, state, attempt, item.hints … }
}
const { meta, introduced, accuracy } = session.summary();
```

**Datamodell.** Den följer byggprompten med två förfiningar:

- `ItemState.dueDay` är en kalenderdag (`YYYY-MM-DD`) i stället för en tidpunkt,
  eftersom passen går per dag.
- `correctDays` är ersatt av `dayBest`: bästa korrekta svarstid per dag och
  svarsformat. Både gränsen för ”flytande” och gränsen för ”automatiserad” räknas
  ut ur samma data, så trösklarna går att ändra i efterhand.

**Statusregler** (`status.ts`, konfigurerbara i `config.ts`):

| Status | Krav |
|---|---|
| ny → inlärning | när faktan introduceras |
| flytande | rätt under 5 s på 2 olika dagar (flerval eller fritt svar) |
| automatiserad | rätt under 3 s på 3 olika dagar, **med fritt svar** |
| fel svar | ett steg ner; nivån måste sedan visas på en ny dag |

Två svar räknas aldrig som bevis: svar samma dag som faktan introducerades, och
rätt svar efter ett fel samma dag. I båda fallen har barnet nyss sett svaret.

**Spridd repetition** (`leitner.ts`): Leitner-lådor med intervallen 1, 2, 4, 7, 14
och 30 dagar. Bara ett rätt svar på en förfallen fakta flyttar den uppåt. Ett fel
skickar den till låda 0.

**Passets sammansättning** (`session.ts`). Passet byggs fråga för fråga, så att det
kan sluta på tid:

1. Omfrågning av fel svar (cirka 3 frågor senare) och repetition av nya fakta
   (2, 5 och 10 frågor efter introduktionen).
2. Uppvärmning med 5 säkra fakta.
3. En ny fakta när `pacingGap` kända fakta har frågats sedan den förra
   (inkrementell repetition). När barnet kan få fakta introduceras färre nya:
   3 + 1 per 4 kända, högst 12 per pass.
4. Förfallna repetitioner, med de svagaste först, blandat över alla enheter.
5. Blandad övning viktad mot svaga fakta, fakta som snart ska repeteras och fakta
   som inte frågats nyligen i passet. Samma fakta kommer aldrig två gånger i rad.

**Takt** (`pacing.ts`). Andelen rätt över de senaste 10 svaren styr avståndet
mellan nya fakta, inom intervallet 3–14 kända. Över 90 % rätt kommer nya fakta
tätare. Under 80 % glesas de ut och pausas. Avståndet sparas mellan passen.

**Upplåsning** (`unlock.ts`). Nästa enhet låses upp när cirka 80 % av den aktuella
enheten är flytande. Antalet avrundas nedåt, så små enheter blir inte strängare:
3 av 4 räcker. En upplåst enhet låses aldrig igen. Ligger barnet över målbandet
räcker 60 % (`easyUnlockFraction`), annars tar det slut på nytt material att öva
på. Sätt värdet till 0,8 för att stänga av lättnaden.

**Fokuspass** (`mode: 'focus'`, `focusItemIds`). Ett frivilligt pass riktat mot
en vald grupp fakta, till exempel en tabell. Cirka 70 % av frågorna i steg 4–5
tas ur gruppen (`config.focus.share`) och resten ur allt annat barnet kan. Att
öva en tabell helt för sig känns effektivt men fastnar sämre än blandad övning,
och barnet kan då svara på mönstret i stället för faktan. Passet får plantera
högst 6 nya fakta ur gruppen (`config.focus.maxNew`), även om faktans enhet inte
är upplåst än. Takten är som vanligt, men så länge barnet kan färre än 4 fakta i
gruppen (`config.focus.minKnown`) kommer en ny så ofta som takten tillåter.
Annars skulle ett pass på en nästan okänd tabell mest nöta de ett eller två fakta
barnet redan har och fyllas ut med annat. Enheten låses inte upp av det, så
dagens pass fortsätter i ordning. Ett fokuspass räknas aldrig som dagens pass.
Innehållspaketet beskriver valbara grupper med `focusSets` (`FocusSet`).

**Svåra fakta: räknestigen** (`support.ts`, `mode`-oberoende). En fakta räknas
som svår om barnet har svarat fel på den på 2 olika dagar, om den har fallit
tillbaka från flytande 2 gånger eller om den har övats i mer än 7 dagar utan att
bli flytande (`config.support`). När en svår fakta kommer upp frågas den i stället
som `derive`, men bara om de fakta den härleds från (`item.derivedFrom`) redan är
flytande, högst en gång per dag och högst 3 gånger per pass. Spelet går då steg
för steg från det barnet kan: 5 × 7 = 35 → 35 + 7 → 6 × 7. Svaret på stigen räknas
inte som bevis och sänker inte heller faktan, eftersom barnet fick hjälp. Några
frågor senare kommer samma fakta tillbaka som en vanlig fråga, och det svaret
räknas. Klarar barnet faktan ur minnet på en senare dag nollställs räkningen
(`settledDay`), och stigen visas inte längre. Stödet trappas alltså ner mot att
plocka fram svaret ur minnet, och härledningen blir inte en permanent omväg.
Utan fritt svar (inställning i föräldravyn) används ingen stig.

**Svarsformat.** Nya fakta och fakta under inlärning frågas med flerval
(4 alternativ). Flytande fakta frågas med fritt svar. Distraktorerna kommer från
innehållspaketet, och barnets egna tidigare felsvar blandas in med hög vikt.

## Återanvända motorn för annat innehåll

Ett innehållspaket implementerar `ContentPack`:

```ts
const glosor: ContentPack = {
  id: 'glosor', version: 1, title: 'Engelska djur',
  items: [{ id: 'hund', prompt: 'hund', answer: 'dog', unitId: 'djur', tags: [],
            derivedFrom: [], hints: [{ kind: 'text', text: 'hund = dog' }], order: 0 }, /* … */],
  units: [{ id: 'djur', title: 'Djur', order: 0, itemIds: ['hund' /* … */], unlockRule: { kind: 'always' } }],
  normalizeAnswer: (s) => s.trim().toLowerCase(),
  distractorCandidates: (item) => /* andra svar i samma enhet */ [],
  focusSets: [{ id: 'djur', title: 'Djur', itemIds: ['hund' /* … */] }], // valfritt
};
const engine = createEngine({ pack: glosor });
```

Ledtrådarna (`Hint`) är data som motorn bara skickar vidare. Spelet bestämmer hur
de visas. Motorns enhetstester använder just ett sådant glosor-paket
(`tests/engine/fixtures.ts`).

## Simulerade elever

`tests/simulation/learner.ts` modellerar eleven med ACT-R-modellen för
faktainlärning, där glömskan beror på hur utspridd övningen är (Pavlik & Anderson,
2005). Varje övning lämnar ett minnesspår, och tät övning glöms snabbare än
utspridd. Modellen innehåller också:

- överföring mellan speglade fakta
- härledning från källfakta
- gissning vid flerval
- svarstider som sjunker med minnesstyrkan

Den **genomsnittliga eleven är kalibrerad mot tidslinjen i forskningsunderlaget**
(hela tabellen på cirka 3–6 månader för en 8–9-åring) och inte mot målet för
andelen rätt. Så ser resultaten ut för 26 veckors simulerad övning, cirka 6 dagar
i veckan, med 10 slumpfrön:

| Elev | Andel rätt under inlärningsfasen | Alla fakta introducerade | Automatiserade efter 26 v |
|---|---|---|---|
| svag | 81–83 % | – (cirka 85 av 100) | 0–1 |
| genomsnittlig | **87,7–89,3 %** | efter 7–9 veckor | 87–95 |
| stark | 96–97 % | efter 3–4 veckor | 97–100 |

Inlärningsfasen räknas tills alla fakta är introducerade. Därefter är passen ren
befästning och blir lättare, vilket är väntat.

**Kända begränsningar:**

- Den starka eleven ligger över 90 % eftersom motorn inte introducerar fler än
  12 nya fakta per pass och inte hoppar över enheter.
- Den svaga eleven når sällan ”automatiserad”, eftersom den simulerade svarstiden
  sällan går under 3 s. Gränsen går att ändra i `config.ts`.
