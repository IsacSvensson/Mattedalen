import { describe, expect, it } from 'vitest';
import { seededRng } from '../../src/engine';
import { buildTowerCheck, CHECK_CATEGORIES, createClockPack, summarizeTowerCheck } from '../../src/content/clock';
import { stairsOutcome, stairFor } from '../../src/places/klocktornet/stairs';
import { handsMistakes } from '../../src/places/klocktornet/parent';

/** Tornets koll and start check (docs/PLAN-KLOCKAN.md, KL4b). */
const pack = createClockPack();
const ids = new Set(pack.items.map((it) => it.id));

describe('Tornets koll', () => {
  it('has ten tasks of four kinds, all real tasks of the tower, mixed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const check = buildTowerCheck(seededRng(seed));
      expect(check).toHaveLength(10);
      for (const c of CHECK_CATEGORIES) expect(check.filter((i) => i.category === c.id)).toHaveLength(c.count);
      for (const i of check) expect(ids.has(i.id), i.id).toBe(true);
      expect(check.filter((i) => i.category === 'stalla').every((i) => i.id.startsWith('kl:stall:'))).toBe(true);
      expect(check[0]!.category).toBe('lasa');
      expect(check[1]!.category).toBe('stalla');
    }
  });

  it('sums up right answers per kind, times in any writing', () => {
    const check = buildTowerCheck(seededRng(3));
    const answers = check.map((item, i) => ({ item, given: i % 2 ? 'fel' : item.answer.replace(/^(\d):/, '0$1:') }));
    const sum = summarizeTowerCheck(answers);
    const right = CHECK_CATEGORIES.reduce((n, c) => n + sum[`${c.id}:right`]!, 0);
    expect(right).toBe(5);
    expect(CHECK_CATEGORIES.reduce((n, c) => n + sum[`${c.id}:total`]!, 0)).toBe(10);
  });
});

describe('the start check, up the stair', () => {
  const ok = { right: 3, asked: 3 };
  const two = { right: 2, asked: 3 };
  const no = { right: 1, asked: 3 };
  it('passes parts with two right of three, and stops at the first that is not', () => {
    expect(stairsOutcome({ urtavlan: ok, timvisaren: two, hel: ok, halv: no })).toEqual({ passedUnitIds: ['urtavlan', 'timvisaren', 'hel'], stoppedAt: 'halv' });
    expect(stairsOutcome({ urtavlan: no })).toEqual({ passedUnitIds: [], stoppedAt: 'urtavlan' });
  });
  it('counts the day for itself, both its questions right', () => {
    expect(stairsOutcome({ dagen: { right: 2, asked: 2 }, urtavlan: no }).passedUnitIds).toEqual(['dagen']);
    expect(stairsOutcome({ dagen: { right: 1, asked: 2 }, urtavlan: ok, timvisaren: no }).passedUnitIds).toEqual(['urtavlan']);
  });
  it('leaves out five minutes at a time while it waits for Stigen', () => {
    expect(stairFor(['femmin'])).not.toContain('femmin');
    expect(stairsOutcome({ urtavlan: ok, timvisaren: ok, hel: ok, halv: ok, kvart: ok }, ['femmin'])).toEqual({ passedUnitIds: ['urtavlan', 'timvisaren', 'hel', 'halv', 'kvart'], stoppedAt: null });
  });
});

describe('how the child sets the hands', () => {
  it('tells the hour hand from the minute hand', () => {
    const a = (given: string, correct = false) => ({ itemId: 'kl:stall:3:30', given, correct });
    expect(handsMistakes([a('4:30'), a('3:15'), a('5:00'), a('3:30', true), { itemId: 'kl:dig:3:30', given: '4:30', correct: false }])).toEqual({ hour: 1, minute: 1, both: 1 });
  });
});
