/**
 * The tower's own start check (docs/PLAN-KLOCKAN.md, KL4): the engine's start
 * check leaves understanding out, and every part of the tower is understanding.
 * The child climbs the stair of the clock, three questions a part, and stops at
 * the first part not passed. The day is asked beside it and never stops it.
 */
export const STAIR = ['urtavlan', 'timvisaren', 'hel', 'halv', 'kvart', 'femmin'] as const;
export const PER_PART = 3;
/** Right answers of the three that pass a part. */
export const PASS_AT = 2;
export const DAY_QUESTIONS = 2;

export interface PartScore {
  right: number;
  asked: number;
}

export interface StairsOutcome {
  passedUnitIds: string[];
  /** The first part on the stair not passed, where learning starts; null when the whole stair passed. */
  stoppedAt: string | null;
}

/** The parts of the stair to ask, in order, without those that wait for another place. */
export const stairFor = (held: readonly string[]) => STAIR.filter((u) => !held.includes(u));

/** Whether a part passed. */
export const passed = (s: PartScore | undefined, needed = PASS_AT) => !!s && s.right >= needed;

/**
 * The outcome: the parts passed up the stair until the first that was not, and
 * the day for itself (both its questions right).
 */
export function stairsOutcome(scores: Record<string, PartScore>, held: readonly string[] = []): StairsOutcome {
  const passedUnitIds: string[] = [];
  let stoppedAt: string | null = null;
  for (const unit of stairFor(held)) {
    if (passed(scores[unit])) passedUnitIds.push(unit);
    else {
      stoppedAt = unit;
      break;
    }
  }
  if (passed(scores.dagen, DAY_QUESTIONS)) passedUnitIds.unshift('dagen');
  return { passedUnitIds, stoppedAt };
}
