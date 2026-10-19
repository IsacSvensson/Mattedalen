# Plan: appen frågar den vuxna hur det går (T)

En ruta i ”För vuxna” som ber den vuxna tycka till. Första gången efter fem
speldagar, sedan högst en gång per kvartal. Allt räknas på enheten, och inget
skickas av appen själv.

## Varför

- **Vi ser inte hur appen används.** Appen spårar ingenting, så det de vuxna
  berättar är det enda vi får veta. ”Tyck till” finns, men bara för den som letar
  upp sidan.
- **Efter fem speldagar** har barnet och den vuxna sett tillräckligt för att ha en
  åsikt, men inte så mycket att de har slutat bry sig.
- **En gång per kvartal** räcker för att höra hur det går över tid, utan att
  tjata.

## Hur

### När

- **Speldagar** räknas ur passen som redan sparas: dagar då något barn på
  enheten har spelat, alla barn tillsammans.
- **Första gången:** när enheten har fem speldagar.
- **Sedan:** tidigast 90 dagar efter förra frågan, och bara om enheten har minst
  fem nya speldagar sedan dess. En enhet som har slutat användas får ingen fråga.
- **Aldrig samtidigt** som rutan ”Nytt i Mattedalen”. Har den visats sedan appen
  startade väntar frågan till nästa gång ”För vuxna” öppnas.

### Var

- **När en vuxen öppnar ”För vuxna”,** efter vuxenkoden, visas rutan över
  översikten. Där vet vi att det är en vuxen. Ett barn möter aldrig rutan.
- **I ”Att göra för dig”** står samma fråga som en rad, tills den vuxna har
  svarat eller tackat nej. Om rutan trycks bort finns frågan alltså kvar.
- **Inte på ”Vem spelar?”** till att börja med (beslutat). Kommer det för få
  svar kan en liten rad där läggas till: ”Till den vuxna: vi vill gärna höra hur
  det går.”

### Rutan

- **Rubrik:** ”Hur går det med Mattedalen?”
- **Text:** en mening om varför: appen spårar ingenting, så det du berättar är det
  enda vi får veta.
- **Tre knappar för svaret:** ”Bra”, ”Så där” och ”Inte bra”. Varje knapp öppnar
  mejlet från ”Tyck till” i den vuxnas eget mejlprogram, med svaret redan
  ifyllt överst, följt av de vanliga frågorna. Ett tryck och sedan skicka.
- **”Inte nu”:** frågar igen om sju dagar, högst två gånger. Sedan väntar frågan
  till nästa kvartal.
- **”Fråga inte igen”:** frågan visas aldrig mer, varken som ruta eller som rad.
  ”Tyck till” finns kvar som förut.
- **Ett svar** räknas som när knappen trycks. Appen kan inte veta om mejlet
  skickades, och ska inte fråga igen förrän nästa kvartal.

### Det som sparas

En inställning på enheten: dagen för senaste frågan, hur många gånger ”Inte nu”
har tryckts, och om den vuxna har valt ”Fråga inte igen”. Inget om barnen, och
inget lämnar enheten.

### Nytt i appen

En post i `src/shell/news.ts` när rutan finns: ”Appen frågar ibland hur det går”.

## Faser

| Fas | Innehåll |
|---|---|
| T1. Frågan | Regeln för när, rutan, raden i ”Att göra”, mejlet med svaret, de tre valen och posten i ”Nytt i appen”. Enhetstester för regeln, e2e, skärmbilder och dokumenten. |

## Fallgropar

- **Ett barn som kan vuxenkoden** kan trycka bort rutan. Raden i ”Att göra” finns
  kvar tills den vuxna har svarat eller tackat nej.
- **Klockan:** dagarna räknas i enhetens kalender, som allt annat i appen. En
  enhet med fel datum kan få frågan för tidigt eller för sent. Det är ofarligt.
- **Flera barn på samma enhet** ger en fråga, inte en per barn. Frågan gäller hur
  appen fungerar i familjen.
- **E2e-tester** som öppnar ”För vuxna” efter många speldagar får en ruta i
  vägen. De behöver ett sätt att stänga den, eller data där frågan redan är
  besvarad.
