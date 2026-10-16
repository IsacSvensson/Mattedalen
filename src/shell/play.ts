import {
  applyPlacement,
  computeUnlocked,
  createEngine,
  makeConfig,
  mathRandomRng,
  systemClock,
  type Clock,
  type ContentPack,
  type Engine,
  type Feedback,
  type FocusSet,
  type ItemState,
  type LearnerMeta,
  type PlacementResult,
  type Question,
  type Rng,
  type Session,
  type SessionMode,
  type SessionSummary,
} from '../engine';
import { MIN_PLACE_MINUTES, plannedMinutes } from './dayPlan';
import { DEFAULT_LOG_KEEP, LOG_COMPACT_SLACK, maybeCompactLog, type Profile, type ProgressStore } from '../storage';

/** Optional practice after the daily session is short and can be stopped any time. */
export const EXTRA_PRACTICE_MINUTES = 5;

export interface GameDeps {
  store: ProgressStore;
  pack: ContentPack;
  clock?: Clock;
  rng?: Rng;
  /** Free-input answers are introduced in a later phase of the build. */
  allowFree?: boolean;
  /**
   * This place's share of the child's daily session (1 when it is the only
   * place). The day's time is shared between the places, so two places do
   * not mean twice the screen time.
   */
  share?: number;
  /**
   * Adjusts loaded progress before use, e.g. counts a new understanding part
   * as known for a child who already knows what builds on it. Saved with the
   * next session.
   */
  prepare?: (states: Record<string, ItemState>) => Record<string, ItemState>;
  /**
   * Parts that wait for another place right now (`heldUnitIds`), e.g. a table
   * in the garden that waits for its part on Stigen.
   */
  held?: (profile: Profile, progress: LoadedProgress, engine: Engine) => Promise<string[]>;
}

export { MIN_PLACE_MINUTES };

/** Minutes of the daily session at a place with the given share of the day (when the day has no plan yet). */
export function placeMinutes(sessionMinutes: number, share = 1): number {
  return share >= 1 ? sessionMinutes : Math.max(MIN_PLACE_MINUTES, Math.round(sessionMinutes * share));
}

export function engineFor(profile: Profile, deps: GameDeps): Engine {
  const clock = deps.clock ?? systemClock;
  // The day's plan decides this place's minutes; before there is one, the day is shared evenly.
  const minutes = plannedMinutes(profile.id, deps.pack.id, clock.today()) ?? placeMinutes(profile.settings.sessionMinutes, deps.share);
  // The pack's own settings first, then the child's.
  const config = makeConfig(deps.pack.config ?? {}, {
    session: { durationMs: minutes * 60_000 },
    format: { allowFree: (deps.allowFree ?? true) && profile.settings.allowFree },
  });
  return createEngine({ pack: deps.pack, config, clock, rng: deps.rng ?? mathRandomRng });
}

export interface LoadedProgress {
  states: Record<string, ItemState>;
  meta: LearnerMeta;
}

export async function loadProgress(profile: Profile, deps: GameDeps, engine = engineFor(profile, deps)): Promise<LoadedProgress> {
  const saved = await deps.store.load(profile.id, deps.pack.id);
  const states = engine.initialStates();
  if (!saved) return { states, meta: engine.initialMeta() };
  // Only items of the current pack, keyed consistently (tolerates old or damaged records).
  for (const id of Object.keys(states)) {
    const s = saved.states[id];
    if (s) states[id] = { ...s, itemId: id };
  }
  return { states: deps.prepare ? deps.prepare(states) : states, meta: saved.meta };
}

/**
 * Runs one session for a profile and keeps storage up to date after every
 * answer, so nothing is lost if the tab is closed mid-session.
 */
export class PlayController {
  /** The latest answer's saves, so finishing never lands before them. */
  private saving: Promise<void> = Promise.resolve();

  private constructor(
    readonly profile: Profile,
    readonly engine: Engine,
    readonly session: Session,
    private readonly deps: GameDeps,
    private readonly metaBefore: LearnerMeta,
    readonly focus?: FocusSet,
  ) {}

  /** `focus` is required for (and only used by) a focus session, e.g. one table. */
  static async start(profile: Profile, deps: GameDeps, mode: SessionMode = 'daily', focus?: FocusSet): Promise<PlayController> {
    if (mode === 'focus' && !focus) throw new Error('A focus session needs a focus set');
    const engine = engineFor(profile, deps);
    const { states, meta } = await loadProgress(profile, deps, engine);
    const heldUnitIds = (await deps.held?.(profile, { states, meta }, engine)) ?? [];
    const session = engine.startSession({
      states,
      meta,
      heldUnitIds,
      mode,
      focusItemIds: mode === 'focus' ? focus?.itemIds : undefined,
      durationMs: mode === 'daily' ? undefined : EXTRA_PRACTICE_MINUTES * 60_000,
    });
    return new PlayController(profile, engine, session, deps, meta, mode === 'focus' ? focus : undefined);
  }

  question(): Question | null {
    return this.session.next();
  }

  isOver(): boolean {
    return this.session.isOver();
  }

  /** How much of the session's time has passed, 0–1. */
  progress(): number {
    return this.session.progress();
  }

  async answer(given: string, rtMs: number): Promise<Feedback> {
    const fb = this.session.submit(given, rtMs);
    const { store, pack } = this.deps;
    this.saving = (async () => {
      await store.appendAttempt({ ...fb.attempt, profileId: this.profile.id, packId: pack.id });
      // Item states are saved right away; learner meta (day done, pacing) only at
      // the end – except today's practised time, so it adds up even if the app
      // is simply closed in the middle of a session.
      await this.saveProgress({ ...this.metaBefore, today: this.session.summary().meta.today });
    })();
    await this.saving;
    return fb;
  }

  /** Ends the session (normally after the time is up, or early if the child leaves). */
  async finish(): Promise<SessionSummary> {
    if (!this.session.isOver()) this.session.end();
    // The child may leave while the last answer is still being saved; that save
    // holds the meta from before the session, so it must not land last.
    await this.saving.catch(() => undefined);
    const summary = this.session.summary();
    if (summary.answered === 0) {
      // Nothing asked, but today's time was already full: the day is done now.
      if (summary.meta.lastSessionDay !== this.metaBefore.lastSessionDay) await this.saveProgress(summary.meta);
      return summary;
    }
    const { store, pack } = this.deps;
    await this.saveProgress(summary.meta);
    await store.saveSession({
      id: summary.sessionId,
      profileId: this.profile.id,
      packId: pack.id,
      mode: summary.mode,
      day: this.session.today,
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      answered: summary.answered,
      correct: summary.correct,
      introduced: summary.introduced,
      ...(this.focus ? { focusId: this.focus.id } : {}),
    });
    await maybeCompactLog(store, this.profile.id, DEFAULT_LOG_KEEP, LOG_COMPACT_SLACK);
    return summary;
  }

  private async saveProgress(meta: LearnerMeta): Promise<void> {
    const { store, pack, clock = systemClock } = this.deps;
    await store.save({
      profileId: this.profile.id,
      packId: pack.id,
      packVersion: pack.version,
      states: this.session.stateRecord(),
      meta,
      updatedAt: clock.now(),
    });
  }
}

/**
 * Stores the outcome of a placement check: passed units become fluent, or
 * learning if the answers were slow (never lowering earlier progress), the
 * answers go into the log and the check is kept as a session record.
 */
export interface PlacementPart {
  /** The pack the check was run on, when it is a part of the place's pack (its units and items are the place's). */
  from: ContentPack;
  /** Further changes from what passed, before the open units are worked out. */
  adjust?: (states: Record<string, ItemState>) => Record<string, ItemState>;
}

export async function savePlacement(
  profile: Profile,
  deps: GameDeps,
  result: PlacementResult,
  startedAt: number,
  part?: PlacementPart,
): Promise<{ states: Record<string, ItemState>; meta: LearnerMeta }> {
  const clock = deps.clock ?? systemClock;
  const engine = engineFor(profile, deps);
  const loaded = await loadProgress(profile, deps, engine);
  const held = (await deps.held?.(profile, loaded, engine)) ?? [];
  let placed = applyPlacement(part?.from ?? deps.pack, engine.config, result, loaded.states, loaded.meta, clock.today(), held);
  if (part) {
    // A part of the pack: the open units are worked out on the whole pack.
    const states = part.adjust ? part.adjust(placed.states) : placed.states;
    const reached = [...loaded.meta.unlockedUnitIds, ...result.passedUnitIds, ...(result.failedUnitIds ?? [])];
    placed = { states, meta: { ...loaded.meta, unlockedUnitIds: computeUnlocked(deps.pack.units, states, reached, undefined, undefined, new Set(held)) } };
  }
  const now = clock.now();
  const sessionId = `placement-${now}`;
  for (const a of result.answers) {
    await deps.store.appendAttempt({
      itemId: a.itemId,
      ts: now,
      sessionId,
      format: 'free',
      kind: 'placement',
      given: a.given,
      correct: a.correct,
      rtMs: a.rtMs,
      profileId: profile.id,
      packId: deps.pack.id,
    });
  }
  await deps.store.save({ profileId: profile.id, packId: deps.pack.id, packVersion: deps.pack.version, ...placed, updatedAt: now });
  await deps.store.saveSession({
    id: sessionId,
    profileId: profile.id,
    packId: deps.pack.id,
    mode: 'placement',
    day: clock.today(),
    startedAt,
    endedAt: now,
    answered: result.answers.length,
    correct: result.answers.filter((a) => a.correct).length,
    introduced: [],
    extra: { passedUnits: result.passedUnitIds.length, fluentUnits: result.fluentUnitIds.length },
  });
  return placed;
}
