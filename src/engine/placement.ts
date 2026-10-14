import { addDays, shuffle, type Rng } from './clock';
import { emptyState, statusRank } from './status';
import { sortedUnits } from './unlock';
import type { ContentPack, DayKey, EngineConfig, Item, ItemId, ItemState, LearnerMeta, UnitId } from './types';

/**
 * Placement check ("startkoll"): a short test that finds how far into the
 * unit progression a learner already is, so someone who knows the easy units
 * does not have to work through them again.
 *
 * Units are tested in order with a few random items each. A unit passes when
 * nearly all its sampled items are answered correctly (3 of 4). One miss too
 * many earns a second chance of two extra items that must both be right
 * (4 of 6), so a single slip does not stop a learner who knows the unit. The
 * check stops at the first unit that does not pass.
 *
 * Time decides how well a passed unit is known, not whether it passes: young
 * children type slowly, and failing a unit they know only because the answers
 * took a few seconds placed them at the very start. A unit is placed as
 * fluent when enough of its right answers were also fast; otherwise as
 * learning ("you know it, now it gets quicker"). The first answer of the check
 * is never counted as slow, since it is also the first go at the number pad.
 */
export interface PlacementConfig {
  /** Items sampled per unit (fewer if the unit is smaller). */
  perUnit: number;
  /** A right answer faster than this counts as fluent. */
  fluentRtMs: number;
  /** A right answer slower than this is counted out step by step, and counts as a miss. */
  maxRtMs: number;
}

export const DEFAULT_PLACEMENT: PlacementConfig = { perUnit: 4, fluentRtMs: 6000, maxRtMs: 20_000 };

export interface PlacementAnswer {
  itemId: ItemId;
  unitId: UnitId;
  given: string;
  correct: boolean;
  rtMs: number;
}

export interface PlacementResult {
  passedUnitIds: UnitId[];
  /** Passed units whose answers were also fast (a subset of `passedUnitIds`). */
  fluentUnitIds: UnitId[];
  /** First unit that did not pass (where learning starts), or null if all passed. */
  stoppedAt: UnitId | null;
  answers: PlacementAnswer[];
}

/** Extra items asked when a unit is one miss short of passing. */
const EXTRA_ITEMS = 2;

/** Correct answers needed: all but one, and all of them for tiny samples. */
export function passThreshold(sampled: number): number {
  return sampled <= 2 ? sampled : sampled - 1;
}

export class Placement {
  private readonly units;
  private unitIndex = 0;
  private queue: Item[] = [];
  private current: Item | null = null;
  private unitHits = 0;
  private unitMisses = 0;
  private unitFast = 0;
  private unitPool: ItemId[] = [];
  private extended = false;
  private done = false;
  private readonly passed: UnitId[] = [];
  private readonly fluent: UnitId[] = [];
  private stoppedAt: UnitId | null = null;
  private readonly answers: PlacementAnswer[] = [];
  private readonly itemById: Map<ItemId, Item>;

  constructor(
    private readonly pack: ContentPack,
    private readonly rng: Rng,
    private readonly cfg: PlacementConfig = DEFAULT_PLACEMENT,
  ) {
    this.units = sortedUnits(pack.units).filter((u) => u.itemIds.length > 0);
    this.itemById = new Map(pack.items.map((i) => [i.id, i]));
    this.loadUnit();
  }

  /** The next item to ask, or null when the check is finished. */
  next(): Item | null {
    if (this.done) return null;
    this.current ??= this.queue.shift() ?? null;
    return this.current;
  }

  submit(rawGiven: string, rtMs: number): boolean {
    const item = this.current;
    if (!item) throw new Error('submit() without an active item');
    this.current = null;
    const unit = this.units[this.unitIndex]!;
    const given = this.pack.normalizeAnswer(rawGiven);
    const correct = given === this.pack.normalizeAnswer(item.answer);
    this.answers.push({ itemId: item.id, unitId: unit.id, given, correct, rtMs });
    const first = this.answers.length === 1;
    if (correct && rtMs < this.cfg.maxRtMs) {
      this.unitHits++;
      if (first || rtMs < this.cfg.fluentRtMs) this.unitFast++;
    } else {
      this.unitMisses++;
    }

    const sampled = Math.min(this.cfg.perUnit, unit.itemIds.length);
    const allowedMisses = sampled - passThreshold(sampled) + (this.extended ? 1 : 0);
    if (this.unitMisses > allowedMisses) {
      if (!this.extended && this.unitPool.length >= EXTRA_ITEMS) {
        // One unlucky slip too many: two more items, both must be right.
        this.extended = true;
        this.queue.push(...this.unitPool.splice(0, EXTRA_ITEMS).map((id) => this.itemById.get(id)!));
      } else {
        // Cannot pass this unit any more: learning starts here.
        this.stoppedAt = unit.id;
        this.done = true;
      }
    } else if (this.queue.length === 0) {
      // Every sample asked without too many misses: the unit is passed.
      this.passed.push(unit.id);
      if (this.unitFast >= passThreshold(sampled)) this.fluent.push(unit.id);
      this.unitIndex++;
      this.loadUnit();
    }
    return correct;
  }

  isDone(): boolean {
    return this.done;
  }

  /** Progress through the units, for a calm progress indicator (0–1). */
  progress(): number {
    return this.done ? 1 : this.unitIndex / this.units.length;
  }

  result(): PlacementResult {
    return {
      passedUnitIds: this.passed.slice(),
      fluentUnitIds: this.fluent.slice(),
      stoppedAt: this.stoppedAt,
      answers: this.answers.slice(),
    };
  }

  private loadUnit(): void {
    const unit = this.units[this.unitIndex];
    this.unitHits = 0;
    this.unitMisses = 0;
    this.unitFast = 0;
    if (!unit) {
      this.done = true;
      this.queue = [];
      return;
    }
    const ids = shuffle(this.rng, unit.itemIds);
    this.queue = ids.slice(0, this.cfg.perUnit).map((id) => this.itemById.get(id)!);
    this.unitPool = ids.slice(this.cfg.perUnit);
    this.extended = false;
  }
}

/**
 * Turns a placement result into learner state. Items of units passed with fast
 * answers become `fluent` (not `automatic`: that still has to be earned) and
 * are scheduled for review spread over the coming week, so a too-generous
 * placement is corrected by ordinary spaced review. Items of units passed with
 * slow answers become `learning`, due over the next few days. Existing
 * progress is never lowered.
 */
export function applyPlacement(
  pack: ContentPack,
  config: EngineConfig,
  result: PlacementResult,
  states: Record<ItemId, ItemState>,
  meta: LearnerMeta,
  today: DayKey,
): { states: Record<ItemId, ItemState>; meta: LearnerMeta } {
  const out: Record<ItemId, ItemState> = { ...states };
  const lastBox = config.leitner.intervalsDays.length - 1;
  const fluent = new Set(result.fluentUnitIds);
  let spread = 0;
  let slowSpread = 0;
  for (const unitId of result.passedUnitIds) {
    const unit = pack.units.find((u) => u.id === unitId);
    const fast = fluent.has(unitId);
    const status = fast ? 'fluent' : 'learning';
    for (const id of unit?.itemIds ?? []) {
      const prev = out[id] ?? emptyState(id);
      if (statusRank(prev.status) >= statusRank(status)) continue;
      out[id] = {
        ...prev,
        status,
        box: Math.max(prev.box, Math.min(fast ? 2 : 1, lastBox)),
        dueDay: fast ? addDays(today, 1 + (spread++ % 7)) : addDays(today, 1 + (slowSpread++ % 3)),
        introducedDay: prev.introducedDay ?? addDays(today, -1),
      };
    }
  }
  const order = sortedUnits(pack.units).map((u) => u.id);
  const reached = new Set([...meta.unlockedUnitIds, ...result.passedUnitIds]);
  if (result.stoppedAt) reached.add(result.stoppedAt);
  // Unlocked units always form a prefix of the progression.
  const lastIndex = Math.max(...order.map((id, i) => (reached.has(id) ? i : -1)));
  const unlockedUnitIds = order.slice(0, lastIndex + 1);
  return { states: out, meta: { ...meta, unlockedUnitIds } };
}
