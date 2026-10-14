import { diffDays } from './clock';
import { atLeast } from './status';
import type { DayKey, EngineConfig, ItemState } from './types';

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
