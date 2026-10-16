import type { Engine, ItemId, ItemState, LearnerMeta, Question, Rng, SessionSummary } from '../../src/engine';
import { ManualClock } from '../../src/engine';

/**
 * Simulated learner based on the ACT-R memory model with spacing-dependent
 * decay (Pavlik & Anderson, 2005), a standard model for fact learning:
 *
 *   activation  m(t) = ln Σ_i (t − t_i)^(−d_i)
 *   decay       d_i  = c · e^(m(t_i)) + α
 *   P(recall)        = 1 / (1 + e^((τ − m) / s))
 *   latency          = minRt + F · e^(−m)
 *
 * Each presentation leaves a trace. Massed practice (high activation at the
 * time of study) decays fast; spaced practice decays slowly. Time between
 * sessions counts as "psychological time" scaled by h (consolidation).
 * Knowing the mirrored twin (commutativity) and derivable source facts give
 * alternative routes to the answer.
 */
export interface LearnerProfile {
  name: string;
  c: number;
  alpha: number;
  tau: number;
  s: number;
  /** Scale on time between sessions. */
  h: number;
  minRtMs: number;
  latencyF: number;
  /** Weight of the twin's traces (3×7 helps 7×3). */
  pairTransfer: number;
  /** Probability to work out an unrecalled answer from recalled source facts. */
  deriveSkill: number;
  /** Probability of eliminating implausible options when guessing. */
  guessSkill: number;
  /** Activation bias for hard facts (negative = harder). */
  hardBias: number;
}

/**
 * "Average" is calibrated against the research summary's timeline, not
 * against the accuracy target: an 8–9-year-old practising 10–15 minutes a day
 * learns the whole 10×10 table in roughly 3–6 months.
 */
export const AVERAGE: LearnerProfile = {
  name: 'genomsnittlig',
  c: 0.217,
  alpha: 0.2,
  tau: -0.62,
  s: 0.25,
  h: 0.025,
  minRtMs: 1300,
  latencyF: 1600,
  pairTransfer: 0.3,
  deriveSkill: 0.4,
  guessSkill: 0.25,
  hardBias: -0.45,
};

export const WEAK: LearnerProfile = {
  ...AVERAGE,
  name: 'svag',
  alpha: 0.225,
  tau: -0.52,
  minRtMs: 1700,
  latencyF: 2200,
  pairTransfer: 0.2,
  deriveSkill: 0.3,
  guessSkill: 0.2,
  hardBias: -0.55,
};

export const STRONG: LearnerProfile = {
  ...AVERAGE,
  name: 'stark',
  alpha: 0.177,
  tau: -0.72,
  minRtMs: 1100,
  latencyF: 1300,
  pairTransfer: 0.5,
  deriveSkill: 0.6,
  guessSkill: 0.35,
  hardBias: -0.3,
};

/**
 * Remembers like the average child but answers slowly (docs/PLAN-GRANSKNING.md,
 * S2): a well-known fact takes about 5 s ("långsam") or 6 s ("mycket långsam"),
 * e.g. a child who writes slowly or checks the answer before giving it.
 */
export const SLOW: LearnerProfile = { ...AVERAGE, name: 'långsam', minRtMs: 3000, latencyF: 2600 };
export const VERY_SLOW: LearnerProfile = { ...AVERAGE, name: 'mycket långsam', minRtMs: 4000, latencyF: 3000 };

interface Trace {
  t: number;
  d: number;
}

/** Gap (s) after which time counts as between sessions. */
const SESSION_GAP_S = 3600;

export class SimulatedLearner {
  private traces = new Map<ItemId, Trace[]>();
  private psych = 0;
  private lastReal: number | null = null;

  constructor(
    readonly profile: LearnerProfile,
    private readonly rng: Rng,
    /** Content-specific difficulty in [0, 1] (0 = easy). */
    private readonly difficulty: (id: ItemId) => number,
    private readonly pairOf: (id: ItemId) => ItemId | undefined,
    private readonly sources: (id: ItemId) => ItemId[],
  ) {}

  private tick(nowMs: number): void {
    if (this.lastReal !== null) {
      const gap = Math.max(0, (nowMs - this.lastReal) / 1000);
      this.psych += gap > SESSION_GAP_S ? gap * this.profile.h : gap;
    }
    this.lastReal = nowMs;
  }

  private strength(id: ItemId): number {
    let sum = 0;
    for (const tr of this.traces.get(id) ?? []) sum += Math.max(1, this.psych - tr.t) ** -tr.d;
    return sum;
  }

  /** Activation including the twin's contribution and item difficulty. */
  activation(id: ItemId): number {
    const pair = this.pairOf(id);
    const sum = this.strength(id) + (pair ? this.profile.pairTransfer * this.strength(pair) : 0);
    if (sum <= 0) return -Infinity;
    return Math.log(sum) + this.profile.hardBias * this.difficulty(id);
  }

  recallProbability(id: ItemId): number {
    const m = this.activation(id);
    if (m === -Infinity) return 0;
    return 1 / (1 + Math.exp((this.profile.tau - m) / this.profile.s));
  }

  private study(id: ItemId): void {
    const own = this.strength(id);
    const d = this.profile.c * (own > 0 ? own : 0) + this.profile.alpha;
    const list = this.traces.get(id) ?? [];
    list.push({ t: this.psych, d });
    this.traces.set(id, list);
  }

  /**
   * Prior knowledge: the learner practised these items before using the app,
   * `reviews` times spread over the past weeks.
   */
  prime(ids: ItemId[], reviews = 100): void {
    const now = this.psych;
    const dayPsych = 86_400 * this.profile.h;
    for (const id of ids) {
      for (let i = reviews; i >= 1; i--) {
        this.psych = now - i * 3 * dayPsych;
        this.study(id);
      }
    }
    this.psych = now;
  }

  answer(q: Question, nowMs: number): { given: string; rtMs: number } {
    this.tick(nowMs);
    const p = this.profile;
    const id = q.item.id;

    if (q.kind === 'new') {
      // The introduction shows the array and the derivation before asking.
      this.study(id);
      const correct = this.rng.next() < 0.92;
      return this.result(q, correct, p.minRtMs + p.latencyF * 2);
    }

    const m = this.activation(id);
    if (this.rng.next() < this.recallProbability(id)) {
      this.study(id);
      const rt = (p.minRtMs + p.latencyF * Math.exp(-m)) * (0.85 + this.rng.next() * 0.3);
      return this.result(q, true, Math.min(rt, 15_000));
    }

    // Not recalled: try to derive from source facts, else guess.
    const srcs = this.sources(id);
    const srcP = srcs.length ? Math.min(...srcs.map((s) => this.recallProbability(s))) : 0.4;
    let correct = this.rng.next() < p.deriveSkill * srcP;
    if (!correct && q.format === 'choice' && q.choices) {
      const n = q.choices.length;
      correct = this.rng.next() < 1 / n + p.guessSkill * (1 - 1 / n) * 0.5;
    }
    // Either way the learner ends up seeing the right answer (feedback).
    this.study(id);
    const rt = p.minRtMs + p.latencyF * (2 + this.rng.next() * 2);
    return this.result(q, correct, rt);
  }

  private result(q: Question, correct: boolean, rtMs: number) {
    if (correct) return { given: q.item.answer, rtMs };
    const wrong = q.choices?.find((c) => c !== q.item.answer) ?? String(Number(q.item.answer) + 1);
    return { given: wrong, rtMs };
  }
}

export interface DayLog {
  day: number;
  summary: SessionSummary;
}

export interface SimulationResult {
  days: DayLog[];
  states: Record<ItemId, ItemState>;
  meta: LearnerMeta;
  questionsTotal: number;
  correctTotal: number;
  /** Max consecutive questions on the same item seen in any session. */
  maxSameInARow: number;
  /** Session overruns beyond the configured duration (ms). */
  maxOverrunMs: number;
}

export interface SimulationOptions {
  days: number;
  /** Probability of practising on a given day. */
  practiceRate?: number;
  /** Time spent on feedback/animations per question, ms. */
  overheadMs?: number;
  wrongOverheadMs?: number;
  startMs?: number;
  /** Start from existing progress (e.g. after a placement check). */
  initial?: { states: Record<ItemId, ItemState>; meta: LearnerMeta };
  /** Units held back on a given day by something outside the pack (`heldUnitIds`). */
  held?: (day: number) => string[];
}

const DAY_MS = 86_400_000;

export function simulate(
  engine: Engine,
  learner: SimulatedLearner,
  rng: Rng,
  opts: SimulationOptions,
  clock: ManualClock,
): SimulationResult {
  const start = opts.startMs ?? Date.UTC(2026, 0, 5, 15, 0, 0);
  let states = opts.initial?.states ?? engine.initialStates();
  let meta = opts.initial?.meta ?? engine.initialMeta();
  const days: DayLog[] = [];
  let questionsTotal = 0;
  let correctTotal = 0;
  let maxSameInARow = 1;
  let maxOverrunMs = 0;

  for (let day = 0; day < opts.days; day++) {
    if (rng.next() > (opts.practiceRate ?? 6 / 7)) continue;
    clock.set(start + day * DAY_MS + Math.floor(rng.next() * 3 * 3_600_000));
    const session = engine.startSession({ states, meta, heldUnitIds: opts.held?.(day) });
    let lastId: ItemId | undefined;
    let run = 1;
    for (let q = session.next(); q; q = session.next()) {
      const { given, rtMs } = learner.answer(q, clock.now());
      clock.advance(rtMs);
      const fb = session.submit(given, rtMs);
      clock.advance(fb.correct ? (opts.overheadMs ?? 2500) : (opts.wrongOverheadMs ?? 8000));
      run = q.item.id === lastId ? run + 1 : 1;
      maxSameInARow = Math.max(maxSameInARow, run);
      lastId = q.item.id;
    }
    const summary = session.summary();
    maxOverrunMs = Math.max(maxOverrunMs, summary.endedAt - summary.startedAt - engine.config.session.durationMs);
    states = session.stateRecord();
    meta = summary.meta;
    questionsTotal += summary.answered;
    correctTotal += summary.correct;
    days.push({ day, summary });
  }
  return { days, states, meta, questionsTotal, correctTotal, maxSameInARow, maxOverrunMs };
}
