import { describe, expect, it } from 'vitest';
import { emptyState, seededRng, type ItemState } from '../../src/engine';
import {
  bestChallengeScore,
  challengeDeck,
  challengePool,
  drawRound,
  duelPool,
  roundWinner,
  scoreRound,
} from '../../src/game/challenge';
import type { SessionRecord } from '../../src/storage';

const st = (id: string, status: ItemState['status']): ItemState => ({ ...emptyState(id), status });

describe('challenge', () => {
  it('only uses facts that are at least fluent', () => {
    const states = { '2x3': st('2x3', 'fluent'), '2x4': st('2x4', 'automatic'), '7x8': st('7x8', 'learning'), '9x9': st('9x9', 'new') };
    expect(challengePool(states).sort()).toEqual(['2x3', '2x4']);
  });

  it('does not repeat recent facts', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'];
    const next = challengeDeck(pool, seededRng(4));
    const seq = Array.from({ length: 60 }, next);
    for (let i = 3; i < seq.length; i++) expect(seq.slice(i - 3, i)).not.toContain(seq[i]);
    expect(new Set(seq).size).toBe(6);
  });

  it('works with a tiny pool', () => {
    const next = challengeDeck(['a'], seededRng(1));
    expect([next(), next()]).toEqual(['a', 'a']);
  });

  it('remembers the best own score', () => {
    const rec = (mode: SessionRecord['mode'], score: number) => ({ mode, correct: score, extra: { score } }) as unknown as SessionRecord;
    expect(bestChallengeScore([])).toBeNull();
    expect(bestChallengeScore([rec('challenge', 12), rec('daily', 90), rec('challenge', 17)])).toBe(17);
  });
});

describe('two-player war', () => {
  const round = { child: { a: 3, b: 4 }, adult: { a: 2, b: 5 } };

  it('the higher correct product wins; a wrong answer scores nothing', () => {
    expect(roundWinner(round, true, true)).toBe('child');
    expect(roundWinner(round, false, true)).toBe('adult');
    expect(roundWinner(round, false, false)).toBe('tie');
    expect(roundWinner({ child: { a: 2, b: 6 }, adult: { a: 3, b: 4 } }, true, true)).toBe('tie');
  });

  it('a tie is war: the next round counts double', () => {
    let s = { child: 0, adult: 0, stake: 1 };
    s = scoreRound(s, 'tie');
    expect(s.stake).toBe(2);
    s = scoreRound(s, 'child');
    expect(s).toEqual({ child: 2, adult: 0, stake: 1 });
  });

  it("both draw from the child's known facts", () => {
    const states = { '2x3': st('2x3', 'learning'), '10x4': st('10x4', 'fluent'), '7x8': st('7x8', 'new') };
    expect(duelPool(states).sort()).toEqual(['10x4', '2x3']);
    const cards = [{ a: 2, b: 3 }, { a: 10, b: 4 }];
    const rng = seededRng(2);
    for (let i = 0; i < 20; i++) {
      const r = drawRound(cards, rng);
      expect(cards).toContainEqual(r.child);
      expect(cards).toContainEqual(r.adult);
    }
  });
});
