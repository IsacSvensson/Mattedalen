import { diffDays } from './clock';
import { atLeast, statusRank } from './status';
import type { DayKey, EngineConfig, Item, ItemId, ItemState } from './types';

/**
 * An item the learner finds hard: wrong on several days, fallen back from
 * fluent more than once, or practised for a long time without becoming
 * fluent. Such items get a supported question (reached in steps from items
 * the learner knows) until they have been answered from memory on a later day.
 */
export function isStruggling(state: ItemState, today: DayKey, cfg: EngineConfig['support']): boolean {
  if (state.status === 'new' || atLeast(state.status, 'fluent')) return false;
  if ((state.wrongDays ?? 0) >= cfg.wrongDays) return true;
  if ((state.drops ?? 0) >= cfg.drops) return true;
  const since = state.settledDay ?? state.introducedDay;
  return since !== null && since !== undefined && diffDays(since, today) > cfg.stuckDays;
}

/**
 * The way to an item from items the learner knows best (docs/PLAN-RAKNESTIG.md):
 * of its paths (`derivedFrom` first, then `paths`) where every step is at least
 * fluent, the one whose weakest step is strongest (status, then box). Equal
 * paths: the first. Null when no path is known yet.
 */
export function knownPath(item: Item, stateOf: (id: ItemId) => ItemState | undefined): ItemId[] | null {
  let best: ItemId[] | null = null;
  let bestScore = -1;
  for (const path of [item.derivedFrom, ...(item.paths ?? [])]) {
    if (path.length === 0) continue;
    let score = Infinity;
    for (const id of path) {
      const s = stateOf(id);
      if (!s || !atLeast(s.status, 'fluent')) {
        score = -1;
        break;
      }
      score = Math.min(score, statusRank(s.status) * 100 + s.box);
    }
    if (score > bestScore) {
      best = path;
      bestScore = score;
    }
  }
  return best;
}
