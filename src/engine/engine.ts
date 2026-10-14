import { systemClock, mathRandomRng, type Clock, type Rng } from './clock';
import { DEFAULT_CONFIG, initialLearnerMeta } from './config';
import { isDue } from './leitner';
import { Session, type SessionOptions } from './session';
import { emptyState } from './status';
import { computeUnlocked, sortedUnits } from './unlock';
import type { ContentPack, EngineConfig, Item, ItemId, ItemState, LearnerMeta, Status } from './types';

export interface EngineDeps {
  pack: ContentPack;
  config?: EngineConfig;
  clock?: Clock;
  rng?: Rng;
}

export interface Engine {
  readonly pack: ContentPack;
  readonly config: EngineConfig;
  item(id: ItemId): Item;
  initialStates(): Record<ItemId, ItemState>;
  initialMeta(): LearnerMeta;
  unlockedUnits(states: Record<ItemId, ItemState>, meta: LearnerMeta): string[];
  dueCount(states: Record<ItemId, ItemState>): number;
  statusCounts(states: Record<ItemId, ItemState>): Record<Status, number>;
  /** True if today's regular session is already done ("the garden is asleep"). */
  dailyDone(meta: LearnerMeta): boolean;
  startSession(opts: SessionOptions): Session;
}

/** Throws if the pack is internally inconsistent. */
export function validatePack(pack: ContentPack): void {
  const ids = new Set<ItemId>();
  for (const item of pack.items) {
    if (ids.has(item.id)) throw new Error(`Duplicate item id ${item.id}`);
    ids.add(item.id);
  }
  const inUnits = new Set<ItemId>();
  for (const unit of pack.units) {
    for (const id of unit.itemIds) {
      if (!ids.has(id)) throw new Error(`Unit ${unit.id} references unknown item ${id}`);
      if (inUnits.has(id)) throw new Error(`Item ${id} is in more than one unit`);
      inUnits.add(id);
    }
  }
  for (const item of pack.items) {
    if (!inUnits.has(item.id)) throw new Error(`Item ${item.id} is not in any unit`);
    if (item.pairId !== undefined) {
      const twin = pack.items.find((i) => i.id === item.pairId);
      if (!twin || twin.pairId !== item.id) throw new Error(`Item ${item.id} has an asymmetric pair`);
    }
    for (const d of item.derivedFrom) if (!ids.has(d)) throw new Error(`Item ${item.id} derives from unknown ${d}`);
  }
  if (sortedUnits(pack.units)[0]?.unlockRule.kind !== 'always') throw new Error('The first unit must always be unlocked');
}

export function createEngine({ pack, config = DEFAULT_CONFIG, clock = systemClock, rng = mathRandomRng }: EngineDeps): Engine {
  validatePack(pack);
  const itemById = new Map(pack.items.map((i) => [i.id, i]));
  const firstUnits = sortedUnits(pack.units)
    .filter((u) => u.unlockRule.kind === 'always')
    .map((u) => u.id);

  const withDefaults = (states: Record<ItemId, ItemState>) =>
    Object.fromEntries(pack.items.map((i) => [i.id, states[i.id] ?? emptyState(i.id)]));

  return {
    pack,
    config,
    item(id) {
      const item = itemById.get(id);
      if (!item) throw new Error(`Unknown item ${id}`);
      return item;
    },
    initialStates: () => withDefaults({}),
    initialMeta: () => initialLearnerMeta(config, firstUnits),
    unlockedUnits: (states, meta) => computeUnlocked(pack.units, withDefaults(states), meta.unlockedUnitIds),
    dueCount(states) {
      const today = clock.today();
      return Object.values(states).filter((s) => isDue(s, today)).length;
    },
    statusCounts(states) {
      const counts: Record<Status, number> = { new: 0, learning: 0, fluent: 0, automatic: 0 };
      for (const s of Object.values(withDefaults(states))) counts[s.status]++;
      return counts;
    },
    dailyDone: (meta) => meta.lastSessionDay === clock.today(),
    startSession(opts) {
      return new Session({ pack, config, clock, rng, itemById }, opts.meta, opts);
    },
  };
}
