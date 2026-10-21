/**
 * "Så kan du hjälpa till" (docs/PLAN-ENKLARE.md, E4): one tip per table in the
 * garden for a grown-up, with a question to ask at home. Delat med shares its
 * table's tip. Built on the same ways to think as the help in a session.
 */
const TABLE_TIPS: Record<string, string> = {
  lika: 'Gånger är lika stora grupper, och dela lika är att fördela. Fråga: 3 tallrikar med 2 kakor på varje, hur många kakor?',
  u2: '×2 är dubbelt. Fråga: vad är dubbelt av 7? Och hälften av 14?',
  u10: '×10 sätter en nolla efter: 6 × 10 är 60. Fråga: hur många fingrar har 4 personer?',
  u5: '×5 är hälften av ×10: 6 × 5 är hälften av 60. Fråga: hur mycket är 7 femkronor?',
  u1: '×1 ändrar ingenting: 8 × 1 är 8. Fråga: 9 korgar med 1 äpple i varje, hur många äpplen?',
  u4: '×4 är dubbelt av dubbelt. Fråga: vad är dubbelt av 6? Och dubbelt av det?',
  u3: '×3 är ×2 och en grupp till: 3 × 7 är 14 + 7. Fråga: hur många hjul har 5 trehjulingar?',
  usq: 'Ett kvadrattal är ett tal gånger sig självt. Lägg 4 rader med 4 i varje och räkna.',
  u9: '×9 är ×10 och en grupp mindre: 9 × 6 är 60 − 6. Fråga: vad är 9 × 4?',
  u6: '×6 är ×5 och en grupp till: 6 × 7 är 35 + 7. Fråga: vad är 6 × 4?',
  u78: '×7 och ×8 byggs av det barnet redan kan: 7 × 8 är 5 × 8 + 2 × 8. Fråga: vad är 8 × 3?',
};

/** Delat med and its table: "Dela lika" with "Lika stora grupper", "Dela med 4" with ×4. */
const SHARES_TIP: Record<string, string> = { delalika: 'lika', dsq: 'usq', d78: 'u78' };

export function gardenTip(unitId: string): string | null {
  const table = SHARES_TIP[unitId] ?? (/^d\d+$/.test(unitId) ? `u${unitId.slice(1)}` : unitId);
  return TABLE_TIPS[table] ?? null;
}
