import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { createHundredPack } from '../../src/content/hundred';
import { createMultiplicationPack } from '../../src/content/multiplication';
import { BROOK_TIPS } from '../../src/places/backen/tips';
import { PATH_TIPS } from '../../src/places/stigen/tips';
import { gardenTip } from '../../src/places/tradgarden/tips';
import { LAID_AT } from '../../src/places/backen/components/bridge';
import { LIT_AT } from '../../src/places/stigen/components/trail';
import { sitterRules } from '../../src/shell/screens/parent/about';
import { childSentence } from '../../src/shell/stats';

/** Explanations when one wonders (docs/PLAN-ENKLARE.md, E4). */
describe('explanations', () => {
  it('a sentence about a child: what can be counted, no judgement', () => {
    const week = [0, 12, 0, 10, 11, 0, 12].map((minutes) => ({ minutes }));
    expect(childSentence('Bosse', week, ['Tiokamrater vid bäcken', '×2 i trädgården'])).toBe(
      'Bosse spelade 4 av de senaste 7 dagarna, i snitt 11 minuter. Nu: Tiokamrater vid bäcken och ×2 i trädgården.',
    );
    expect(childSentence('Alva', week.map(() => ({ minutes: 0 })), ['Ett mer, ett mindre vid bäcken'])).toBe(
      'Alva har inte spelat de senaste 7 dagarna. Nu: Ett mer, ett mindre vid bäcken.',
    );
  });

  it('every part of every place has a tip for grown-ups', () => {
    expect(createAdditionPack().units.filter((u) => !BROOK_TIPS[u.id]).map((u) => u.id)).toEqual([]);
    expect(createHundredPack().units.filter((u) => !PATH_TIPS[u.id]).map((u) => u.id)).toEqual([]);
    expect(createMultiplicationPack({ division: true }).units.filter((u) => !gardenTip(u.id)).map((u) => u.id)).toEqual([]);
  });

  it('what "sitter" means is read from the engine, and the stones and lanterns from their own thresholds', () => {
    const s = DEFAULT_CONFIG.status;
    const rules = sitterRules();
    expect(rules.sits).toBe(`Rätt svar under ${s.fluentRtMs / 1000} sekunder på ${s.fluentDays} olika dagar.`);
    expect(rules.automatic).toBe(`Rätt svar under ${s.automaticRtMs / 1000} sekunder på ${s.automaticDays} olika dagar, utan svarsalternativ.`);
    expect(rules.window).toBe(`Svaren räknas inom ${s.keepEvidenceDays} dagar.`);
    // The page says "ungefär fyra av fem fakta i delen".
    expect([LAID_AT, LIT_AT]).toEqual([0.8, 0.8]);
  });
});
