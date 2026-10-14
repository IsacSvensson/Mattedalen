import {
  applyPlacement,
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
}

export function engineFor(profile: Profile, deps: GameDeps): Engine {
  // The pack's own settings first, then the child's.
  const config = makeConfig(deps.pack.config ?? {}, {
    session: { durationMs: profile.settings.sessionMinutes * 60_000 },
    format: { allowFree: (deps.allowFree ?? true) && profile.settings.allowFree },
  });
  return createEngine({ pack: deps.pack, config, clock: deps.clock ?? systemClock, rng: deps.rng ?? mathRandomRng });
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
  return { states, meta: saved.meta };
}

/**
 * Runs one session for a profile and keeps storage up to date after every
 * answer, so nothing is lost if the tab is closed mid-session.
 */
export class PlayController {
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
    const session = engine.startSession({
      states,
      meta,
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
    await store.appendAttempt({ ...fb.attempt, profileId: this.profile.id, packId: pack.id });
    // Item states are saved right away; learner meta (day done, pacing) only at
    // the end – except today's practised time, so it adds up even if the app
    // is simply closed in the middle of a session.
    await this.saveProgress({ ...this.metaBefore, today: this.session.summary().meta.today });
    return fb;
  }

  /** Ends the session (normally after the time is up, or early if the child leaves). */
  async finish(): Promise<SessionSummary> {
    if (!this.session.isOver()) this.session.end();
    const summary = this.session.summary();
    if (summary.answered === 0) return summary;
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
export async function savePlacement(
  profile: Profile,
  deps: GameDeps,
  result: PlacementResult,
  startedAt: number,
): Promise<{ states: Record<string, ItemState>; meta: LearnerMeta }> {
  const clock = deps.clock ?? systemClock;
  const engine = engineFor(profile, deps);
  const loaded = await loadProgress(profile, deps, engine);
  const placed = applyPlacement(deps.pack, engine.config, result, loaded.states, loaded.meta, clock.today());
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
