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
  type ItemState,
  type LearnerMeta,
  type PlacementResult,
  type Question,
  type Rng,
  type Session,
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
  const config = makeConfig({
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
  ) {}

  static async start(profile: Profile, deps: GameDeps, mode: 'daily' | 'extra' = 'daily'): Promise<PlayController> {
    const engine = engineFor(profile, deps);
    const { states, meta } = await loadProgress(profile, deps, engine);
    const session = engine.startSession({
      states,
      meta,
      mode,
      durationMs: mode === 'extra' ? EXTRA_PRACTICE_MINUTES * 60_000 : undefined,
    });
    return new PlayController(profile, engine, session, deps, meta);
  }

  question(): Question | null {
    return this.session.next();
  }

  isOver(): boolean {
    return this.session.isOver();
  }

  async answer(given: string, rtMs: number): Promise<Feedback> {
    const fb = this.session.submit(given, rtMs);
    const { store, pack } = this.deps;
    await store.appendAttempt({ ...fb.attempt, profileId: this.profile.id, packId: pack.id });
    // Item states are saved right away; learner meta (day done, pacing) only at the end.
    await this.saveProgress(this.metaBefore);
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
 * Stores the outcome of a placement check: passed units become fluent (never
 * lowering earlier progress), the answers go into the log and the check is
 * kept as a session record.
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
    extra: { passedUnits: result.passedUnitIds.length },
  });
  return placed;
}
