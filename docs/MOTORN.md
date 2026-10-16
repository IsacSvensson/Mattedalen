# Faktamotorn

Motorn i `src/engine` bär alla platser i Mattedalen som tränar fakta. Den kommer
från Gångerträdgården och används som den är. Trädgården (multiplikation) är den
första platsen som använder den, se [TRADGARDEN.md](TRADGARDEN.md).

En del (`Unit`) är en kunskapskomponent: fakta som lärs in tillsammans, med
förkunskaper som kanter i en graf. Se ordningen i
[OVERLAMNING-MATTEDALEN.md](OVERLAMNING-MATTEDALEN.md) och planen för Bäcken i
[PLAN-BACKEN.md](PLAN-BACKEN.md).

## Graf, format och uteslutna fakta

- **Graf.** En del kan öppnas efter föregående del (`previous`, som i
  Trädgården) eller efter alla sina förkunskaper (`after`, med `requires`). En
  del öppnas när ungefär `fraction` av varje förkunskap är minst `minStatus`. En
  del får bara kräva delar som kommer före den, och `validatePack` kontrollerar
  det. En öppnad del stängs aldrig igen.
- **Sort.** En del är fakta (minnet, där snabbheten räknas) eller förståelse
  (`kind: 'understanding'`, visas på olika dagar och i olika former).
- **Olika format för samma fakta.** Paketet kan ange `present(item, …)`, som ger
  en prompt och ett namn på formatet, till exempel `7 + 5 = __` eller
  `__ = 7 + 5`. Svaret är alltid faktans. Formatet sparas i svarsloggen
  (`Attempt.variant`). Ett format kan markeras som inget bevis
  (`evidence: false`), och då flyttar ett rätt svar inte upp faktan. Paket utan
  `present` drar samma slumptal som förut.
- **Inställningar per paket.** `pack.config` läggs ovanpå standardvärdena och
  under spelets egna (`makeConfig(pack.config, …)`), till exempel gränserna för
  svarstid.
- **Svarsformat per fakta.** `Item.formats` begränsar hur en fakta kan frågas,
  till exempel bara flerval för ”stämmer det?” (ja eller nej).
- **Statusregler per del.** `Unit.status` skriver över paketets regler för en
  del. En förståelsedel (Vågen i Bäcken) bedöms då på rätt svar på olika dagar,
  utan tidsgräns.
- **Startkollen följer grafen.** En del testas bara när dess förkunskaper
  klarades: föregående del (`previous`) eller alla som krävs (`after`). I en
  kedja av delar (Trädgården) stannar kollen därför vid första missen, som förut.
  I en graf (Bäcken) hoppar en miss bara över det som bygger på den. Delar om
  förståelse ingår inte. Efter kollen räknas upplåsningen med samma graf.
- **Fakta som kräver andra fakta.** En fakta kan ha `requires`: den introduceras
  först när alla de fakta den kräver är minst flytande. Delat med i Trädgården
  använder det, så att 21 ÷ 3 kommer först när både 3 × 7 och 7 × 3 sitter. Har
  faktan väl introducerats stannar den, vad som än händer med de andra. Delar med
  sådana fakta ingår inte i startkollen.
- **Spår för nya fakta.** En del kan ha ett spår (`lane`). Delar i olika spår
  turas om att ge nya fakta i ett pass: det spår som fått minst nya i passet går
  före, och vid lika går spåret med den första delen före. Delat med i Trädgården
  har ett eget spår. Ett barn som redan kan många tabeller får därför nästa
  tabell och de öppna divisionerna omväxlande, inte alla divisioner först.
- **Delar som väntar på något utanför paketet** (`heldUnitIds` i passet,
  `Held` i `unlock.ts`). En sådan del öppnar inte av sin egen regel, inte heller
  i ett fokuspass, som annars får öppna delar tidigt. En del som redan är öppen,
  eller där någon fakta är påbörjad, hålls aldrig: det som är påbörjat stängs
  aldrig. Startkollen öppnar en hållen del bara om den klaras. Motorn vet inget om
  vad som håller; det räknar platsen ut, till exempel från en annan plats framsteg.
  Platsen ger det via `GameDeps.held`, som används i passet och i startkollen.
  Trädgårdens tabeller väntar så på Stigen, och Stigens delar på bäcken.
- **Uteslutna fakta.** Ett pass kan få `excludedItemIds`. De frågas aldrig, inte
  ens som nya eller förfallna, och räknas inte heller när delar öppnas. En del
  där hälften hålls utanför (pilotens otränade halva) kan därför ändå öppna det
  som kommer efter.

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
| automatiserad | rätt under 4 s på 3 olika dagar, **med fritt svar** |
| fel svar | ett steg ner; nivån måste sedan visas på en ny dag. Det högsta läget faktan nått sparas (`peak`), så att en fakta som varit flytande visas som planta och inte som frö. |

Dagarna räknas inom 30 dagar (`keepEvidenceDays`). Förut var det 3 s och 10
dagar. Då fick det genomsnittliga simulerade barnet inga träd alls på ett år,
eftersom en flytande fakta kommer tillbaka bara var 4:e till 30:e dag
([PLAN-GRANSKNING, S2](PLAN-GRANSKNING.md#fynd-från-s2)).

**Ge mer tid** (ett val för vuxna, `ProfileSettings.moreTime`): gränserna
fördubblas, till 10 s för flytande och 8 s för automatiserad. Resten av reglerna
gäller som förut. Valet är för ett barn som svarar rätt men långsamt. Föräldravyn
föreslår det under ”Att göra för dig” när minst 5 fakta är rätt på 2 dagar men
aldrig under gränsen, och barnet är långsamt i sig: även dess tionde
snabbaste fakta, på alla platser, tar 3,7 s eller mer (`slowFacts` i
`shell/stats.ts`). Ett barn som har svårt att minnas svarar snabbt på det
lättaste, och får inte förslaget. För det barnet skulle mer tid bara göra
uträknade svar till buskar.

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
som `derive`, men bara om de fakta den härleds från redan är flytande, högst en
gång per dag och högst 3 gånger per pass. En fakta kan ha flera vägar
(`item.derivedFrom` först, sedan `item.paths`). Motorn tar den väg barnet kan
bäst (`knownPath` i `support.ts`): bland vägarna där alla steg är flytande den
där det svagaste steget är starkast. Vägen följer med frågan (`Question.from`),
så att stigen och hjälpen visar samma väg
([PLAN-RAKNESTIG](PLAN-RAKNESTIG.md)). Spelet går då steg
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
  sällan går under gränsen. Gränsen går att ändra i `config.ts`.
