import { systemClock, type DayKey, type Engine, type ItemId, type ItemState, type LearnerMeta } from '../../engine';
import type { Profile, SessionRecord } from '../../storage';
import type { AppContext } from '../../shell/app';
import { loadProgress } from '../../shell/play';
import { heldTables, tablesWaiting } from './waits';

/** Where the days were kept before they moved into the profile (and so into backups and the QR code). */
const legacyReadyKey = (profileId: string) => `tableReady:${profileId}`;

/** Sessions that count as playing: not the start check or a koll, and at least one answer. */
const PLAY_MODES: readonly SessionRecord['mode'][] = ['daily', 'extra', 'focus', 'challenge', 'duel'];

/** The days the child played anywhere in the valley. */
export function playDays(sessions: readonly SessionRecord[]): DayKey[] {
  return [...new Set(sessions.filter((s) => s.answered > 0 && PLAY_MODES.includes(s.mode)).map((s) => s.day))];
}

/** The day each table could first have opened, for this child (see `heldTables`). */
export async function tableReady(ctx: AppContext, profile: Profile): Promise<Record<string, DayKey>> {
  return profile.settings.tableReady ?? (await ctx.store.getSetting<Record<string, DayKey>>(legacyReadyKey(profile.id))) ?? {};
}

/** Saves the days into the stored profile and the one in hand, so a later save from the parent view keeps them. */
export async function saveTableReady(ctx: AppContext, profile: Profile, ready: Record<string, DayKey>): Promise<void> {
  const stored = (await ctx.store.getProfile(profile.id)) ?? profile;
  await ctx.store.saveProfile({ ...stored, settings: { ...stored.settings, tableReady: ready } });
  profile.settings.tableReady = ready;
}

export interface GardenWaits {
  /** Tables held today (for the engine). */
  held: string[];
  /** Tables that would open now, but wait for Stigen: what the garden and the parent view tell. */
  waitingNow: string[];
}

/**
 * The garden's tables that wait for Stigen today, worked out from the child's
 * progress on Stigen (`TABLES_WAIT`). Without Stigen in the valley, or when a
 * grown-up has turned the waiting off, nothing waits.
 */
export async function gardenWaits(
  ctx: AppContext,
  profile: Profile,
  progress: { states: Record<ItemId, ItemState>; meta: LearnerMeta },
  engine: Engine,
): Promise<GardenWaits> {
  const path = ctx.places.find((p) => p.pack.id === 'hundred');
  if (!path || profile.settings.tablesWait === false) return { held: [], waitingNow: [] };
  const pathStates = (await loadProgress(profile, { store: ctx.store, pack: path.pack })).states;
  const waiting = tablesWaiting(path.pack, pathStates, { pack: engine.pack, states: progress.states });
  if (!waiting.length) return { held: [], waitingNow: [] };
  const could = new Set(engine.unlockedUnits(progress.states, progress.meta));
  const ready = await tableReady(ctx, profile);
  const days = playDays(await ctx.store.listSessions(profile.id));
  const out = heldTables(waiting, could, ready, systemClock.today(), days);
  if (out.changed || profile.settings.tableReady === undefined) await saveTableReady(ctx, profile, out.ready);
  const open = new Set(engine.unlockedUnits(progress.states, progress.meta, undefined, out.held));
  return { held: out.held, waitingNow: [...could].filter((u) => !open.has(u)) };
}
