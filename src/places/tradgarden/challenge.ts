import { atLeast, randInt, type ItemId, type ItemState, type Rng } from '../../engine';
import { isFactId } from '../../content/multiplication';
import type { SessionRecord } from '../../storage';

/** "Beat your own record": short, timed, only with facts the child already knows well. */
export const CHALLENGE_SECONDS = 90;
/** The challenge opens once this many facts are at least fluent. */
export const CHALLENGE_MIN_FACTS = 5;
/** A challenge for one table opens once this many of its facts are at least fluent. */
export const CHALLENGE_MIN_FOCUS_FACTS = 4;

/** Multiplications the child knows well, optionally only those in one focus set (e.g. ×7). Delat med stays out for now. */
export function challengePool(states: Record<ItemId, ItemState>, focusItemIds?: readonly ItemId[]): ItemId[] {
  const only = focusItemIds ? new Set(focusItemIds) : null;
  return Object.values(states)
    .filter((s) => isFactId(s.itemId) && atLeast(s.status, 'fluent') && (!only || only.has(s.itemId)))
    .map((s) => s.itemId);
}

export function canChallenge(states: Record<ItemId, ItemState>, focusItemIds?: readonly ItemId[]): boolean {
  return challengePool(states, focusItemIds).length >= (focusItemIds ? CHALLENGE_MIN_FOCUS_FACTS : CHALLENGE_MIN_FACTS);
}

/** Endless sequence of facts from the pool without repeating any of the last few. */
export function challengeDeck(pool: readonly ItemId[], rng: Rng): () => ItemId {
  const recent: ItemId[] = [];
  const memory = Math.min(Math.floor(pool.length / 2), 6);
  return () => {
    const options = pool.filter((id) => !recent.includes(id));
    const next = options[randInt(rng, options.length)] ?? (pool[randInt(rng, pool.length)] as ItemId);
    recent.push(next);
    if (recent.length > memory) recent.shift();
    return next;
  };
}

/**
 * Best earlier challenge score of a child (only compared with themselves).
 * Each focus set has its own record, separate from the all-facts one.
 */
export function bestChallengeScore(sessions: readonly SessionRecord[], focusId?: string): number | null {
  const scores = sessions
    .filter((s) => s.mode === 'challenge' && s.focusId === focusId)
    .map((s) => s.extra?.score ?? s.correct);
  return scores.length ? Math.max(...scores) : null;
}

// --- two players: multiplication war ------------------------------------

export const DUEL_ROUNDS = 7;

export interface DuelCard {
  a: number;
  b: number;
}

/**
 * Both players draw a fact from the same pool (the child's known facts, so
 * the grown-up gets no easier cards). Each answers their own; the higher
 * correct product takes the round. A wrong answer scores nothing, and a tie
 * means "krig": the next round is worth double.
 */
export interface DuelRound {
  child: DuelCard;
  adult: DuelCard;
}

export function duelPool(states: Record<ItemId, ItemState>): ItemId[] {
  const known = Object.values(states)
    .filter((s) => isFactId(s.itemId) && s.status !== 'new')
    .map((s) => s.itemId);
  return known;
}

export function drawRound(pool: readonly DuelCard[], rng: Rng): DuelRound {
  const child = pool[randInt(rng, pool.length)] as DuelCard;
  let adult = pool[randInt(rng, pool.length)] as DuelCard;
  for (let tries = 0; tries < 5 && adult.a === child.a && adult.b === child.b; tries++) adult = pool[randInt(rng, pool.length)] as DuelCard;
  return { child, adult };
}

export type RoundWinner = 'child' | 'adult' | 'tie';

export function roundWinner(round: DuelRound, childCorrect: boolean, adultCorrect: boolean): RoundWinner {
  const c = childCorrect ? round.child.a * round.child.b : 0;
  const v = adultCorrect ? round.adult.a * round.adult.b : 0;
  if (c === v) return 'tie';
  return c > v ? 'child' : 'adult';
}

export interface DuelScore {
  child: number;
  adult: number;
  /** Points the next round is worth (doubles after a tie). */
  stake: number;
}

export function scoreRound(score: DuelScore, winner: RoundWinner): DuelScore {
  if (winner === 'tie') return { ...score, stake: score.stake * 2 };
  return { ...score, [winner]: score[winner] + score.stake, stake: 1 };
}
