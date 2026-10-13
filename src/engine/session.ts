import { diffDays, randomId, shuffle, weightedPick, type Clock, type Rng } from './clock';
import { buildChoices } from './distractors';
import { applyLeitner, isDue } from './leitner';
import { PacingController } from './pacing';
import { applyStatus, atLeast, emptyState } from './status';
import { computeUnlocked, sortedUnits } from './unlock';
import type {
  AnswerFormat,
  Attempt,
  ContentPack,
  EngineConfig,
  Item,
  ItemId,
  ItemState,
  LearnerMeta,
  QuestionKind,
  Status,
} from './types';

export type SessionMode = 'daily' | 'extra';

export interface SessionOptions {
  states: Record<ItemId, ItemState>;
  meta: LearnerMeta;
  /** `daily` is the regular session; `extra` is optional practice afterwards (no new items). */
  mode?: SessionMode;
  durationMs?: number;
  sessionId?: string;
}

export interface Question {
  seq: number;
  item: Item;
  kind: QuestionKind;
  format: AnswerFormat;
  /** Options for multiple choice (includes the correct answer). */
  choices?: string[];
  /** True if the item's mirrored twin is already known (useful for "turn it around" hints). */
  pairKnown: boolean;
}

export interface Feedback {
  correct: boolean;
  given: string;
  expected: string;
  item: Item;
  previousStatus: Status;
  state: ItemState;
  attempt: Attempt;
}

export interface SessionSummary {
  sessionId: string;
  mode: SessionMode;
  startedAt: number;
  endedAt: number;
  answered: number;
  correct: number;
  accuracy: number | null;
  /** Ran the full configured time. */
  completed: boolean;
  introduced: ItemId[];
  promoted: ItemId[];
  meta: LearnerMeta;
}

interface Pending {
  itemId: ItemId;
  atSeq: number;
  kind: 'retry' | 'rehearse';
}

interface Deps {
  pack: ContentPack;
  config: EngineConfig;
  clock: Clock;
  rng: Rng;
  itemById: Map<ItemId, Item>;
}

/**
 * One practice session. Every step is a retrieval question; the session is
 * assembled adaptively, one question at a time, so it can end on time:
 *
 * 1. scheduled retries (wrong answers) and rehearsals of just-introduced items
 * 2. warm-up with safe items
 * 3. a new item whenever `pacingGap` known items have been asked since the last one
 * 4. items due for spaced review (Leitner)
 * 5. weighted mixed practice over all unlocked units
 */
export class Session {
  readonly id: string;
  readonly mode: SessionMode;
  readonly startedAt: number;
  readonly today: string;
  private readonly durationMs: number;
  private readonly states: Map<ItemId, ItemState>;
  private readonly pacing: PacingController;
  private readonly maxNew: number;
  private unlocked: string[];
  private pending: Pending[] = [];
  private warmup: ItemId[];
  private due: ItemId[];
  private recent: ItemId[] = [];
  private askedCount = new Map<ItemId, number>();
  private lastAskedSeq = new Map<ItemId, number>();
  private daysUntilCache = new Map<string, number>();
  private retries = new Map<ItemId, number>();
  private introduced: ItemId[] = [];
  private promoted = new Set<ItemId>();
  private sinceNew: number;
  private askCap: number;
  private seq = 0;
  private answered = 0;
  private correctCount = 0;
  private current: Question | null = null;
  private endedAt: number | null = null;

  constructor(
    private readonly deps: Deps,
    private readonly meta: LearnerMeta,
    opts: SessionOptions,
  ) {
    const { config, clock, rng, pack } = deps;
    this.id = opts.sessionId ?? randomId(rng);
    this.mode = opts.mode ?? 'daily';
    this.startedAt = clock.now();
    this.today = clock.today();
    this.durationMs = opts.durationMs ?? config.session.durationMs;
    this.states = new Map(pack.items.map((it) => [it.id, opts.states[it.id] ?? emptyState(it.id)]));
    this.pacing = new PacingController(config.pacing, meta.pacingGap);
    this.unlocked = computeUnlocked(pack.units, this.stateRecord(), meta.unlockedUnitIds, this.relaxedUnlock());

    const known = [...this.states.values()].filter((s) => s.status !== 'new');
    const p = config.pacing;
    this.maxNew =
      this.mode === 'extra' ? 0 : Math.min(p.maxNewPerSession, p.bootstrapNew + Math.floor(known.length / p.knownPerNew));
    // Let the first new item come right after the warm-up.
    this.sinceNew = this.pacing.gap;
    this.askCap = config.session.maxAsksPerItem;

    this.warmup = this.mode === 'daily' ? this.pickWarmup(known) : [];
    this.due = this.sortDue(known.filter((s) => isDue(s, this.today)));
  }

  /** Current question, or null when the session is over. Idempotent until `submit`. */
  next(): Question | null {
    if (this.current) return this.current;
    if (this.isOver()) return null;
    const pick = this.pick();
    if (!pick) return null;
    const item = this.item(pick.itemId);
    const state = this.state(pick.itemId);
    const format = this.formatFor(state, pick.kind);
    const { config, pack, rng } = this.deps;
    this.seq++;
    this.current = {
      seq: this.seq,
      item,
      kind: pick.kind,
      format,
      choices: format === 'choice' ? buildChoices(pack, item, state, rng, config.format.choiceCount) : undefined,
      pairKnown: item.pairId !== undefined && this.state(item.pairId).status !== 'new',
    };
    return this.current;
  }

  submit(rawGiven: string, rtMs: number): Feedback {
    const q = this.current;
    if (!q) throw new Error('submit() without an active question');
    const { pack, config, clock } = this.deps;
    const given = pack.normalizeAnswer(rawGiven);
    const expected = pack.normalizeAnswer(q.item.answer);
    const correct = given === expected;
    const prev = this.state(q.item.id);
    const now = clock.now();

    let next = applyStatus(prev, { correct, given, rtMs, format: q.format, now, today: this.today }, config.status);
    next = applyLeitner(prev, next, correct, this.today, config.leitner.intervalsDays);
    this.states.set(q.item.id, next);
    if (next.status !== prev.status && atLeast(next.status, 'fluent') && !atLeast(prev.status, next.status)) {
      this.promoted.add(q.item.id);
    }

    this.answered++;
    if (correct) this.correctCount++;
    this.pacing.record(correct);
    this.recent.push(q.item.id);
    if (this.recent.length > 10) this.recent.shift();
    this.askedCount.set(q.item.id, (this.askedCount.get(q.item.id) ?? 0) + 1);
    this.lastAskedSeq.set(q.item.id, q.seq);

    if (q.kind === 'new') {
      this.introduced.push(q.item.id);
      this.sinceNew = 0;
      for (const gap of config.session.rehearsalGaps) {
        this.pending.push({ itemId: q.item.id, atSeq: q.seq + gap, kind: 'rehearse' });
      }
    } else if (q.kind !== 'rehearse') {
      this.sinceNew++;
    }

    if (!correct && q.kind !== 'new') {
      const used = this.retries.get(q.item.id) ?? 0;
      const alreadyPending = this.pending.some((p) => p.itemId === q.item.id);
      if (used < config.session.maxRetriesPerItem && !alreadyPending) {
        this.retries.set(q.item.id, used + 1);
        this.pending.push({ itemId: q.item.id, atSeq: q.seq + config.session.retryGap, kind: 'retry' });
      }
    }

    // Fluency can be reached mid-session, which may open the next unit.
    if (next.status !== prev.status || this.answered % 10 === 0) {
      this.unlocked = computeUnlocked(pack.units, this.stateRecord(), this.unlocked, this.relaxedUnlock());
    }
    this.current = null;

    const attempt: Attempt = {
      itemId: q.item.id,
      ts: now,
      sessionId: this.id,
      format: q.format,
      kind: q.kind,
      given,
      correct,
      rtMs,
    };
    return { correct, given, expected, item: q.item, previousStatus: prev.status, state: next, attempt };
  }

  /** True once the configured duration has passed (the current question may still be answered). */
  isOver(): boolean {
    return this.endedAt !== null || this.deps.clock.now() - this.startedAt >= this.durationMs;
  }

  /** End early (e.g. the child leaves). */
  end(): void {
    this.endedAt ??= this.deps.clock.now();
    this.current = null;
  }

  stateRecord(): Record<ItemId, ItemState> {
    return Object.fromEntries(this.states);
  }

  /** True when the session ran its full time (ending early does not count as the day's session). */
  completed(): boolean {
    const end = this.endedAt ?? this.deps.clock.now();
    return end - this.startedAt >= this.durationMs;
  }

  summary(): SessionSummary {
    const accuracy = this.answered ? this.correctCount / this.answered : null;
    const prevEma = this.meta.accuracyEma;
    const countsAsDaily = this.mode === 'daily' && this.answered > 0 && this.completed();
    const meta: LearnerMeta = {
      ...this.meta,
      pacingGap: this.pacing.gap,
      unlockedUnitIds: this.unlocked,
      accuracyEma: accuracy === null ? prevEma : prevEma === null ? accuracy : prevEma * 0.7 + accuracy * 0.3,
      sessionsCompleted: this.meta.sessionsCompleted + (countsAsDaily ? 1 : 0),
      lastSessionDay: countsAsDaily ? this.today : this.meta.lastSessionDay,
    };
    return {
      sessionId: this.id,
      mode: this.mode,
      startedAt: this.startedAt,
      endedAt: this.endedAt ?? this.deps.clock.now(),
      answered: this.answered,
      correct: this.correctCount,
      accuracy,
      completed: this.completed(),
      introduced: this.introduced.slice(),
      promoted: [...this.promoted],
      meta,
    };
  }

  /**
   * When the learner is above the target band (over recent sessions, or in
   * this one), new material may be opened earlier: units unlock at a lower
   * share of fluent items.
   */
  private relaxedUnlock(): number | undefined {
    const p = this.deps.config.pacing;
    const ema = this.meta.accuracyEma;
    const sessionAcc = this.answered >= 30 ? this.correctCount / this.answered : null;
    const easy = (ema !== null && ema > p.targetHigh) || (sessionAcc !== null && sessionAcc > p.targetHigh);
    return easy ? p.easyUnlockFraction : undefined;
  }

  // --- selection -----------------------------------------------------------

  private pick(): { itemId: ItemId; kind: QuestionKind } | null {
    const last = this.recent[this.recent.length - 1];

    // 1. Scheduled retries and rehearsals.
    const ready = this.pending
      .filter((p) => p.atSeq <= this.seq + 1 && p.itemId !== last)
      .sort((a, b) => a.atSeq - b.atSeq)[0];
    if (ready) {
      this.pending.splice(this.pending.indexOf(ready), 1);
      return { itemId: ready.itemId, kind: ready.kind };
    }

    // 2. Warm-up.
    while (this.warmup.length) {
      const id = this.warmup.shift() as ItemId;
      if (id !== last) return { itemId: id, kind: 'warmup' };
    }

    // 3. New item (incremental rehearsal: one new among several known).
    const knownPool = this.knownPool();
    const canIntroduce =
      this.introduced.length < this.maxNew && this.sinceNew >= this.pacing.gap && this.pacing.allowNew();
    if (canIntroduce || (knownPool.length === 0 && this.mode === 'daily')) {
      const candidate = this.nextNewCandidate();
      if (candidate) return { itemId: candidate, kind: 'new' };
    }

    // 4. Spaced review of due items.
    const avoid = new Set(this.recent.slice(-this.deps.config.session.avoidRecent));
    for (let i = 0; i < this.due.length; i++) {
      const id = this.due[i] as ItemId;
      const s = this.state(id);
      if (!isDue(s, this.today) || this.askedCount.has(id)) {
        this.due.splice(i--, 1);
        continue;
      }
      if (avoid.has(id)) continue;
      this.due.splice(i, 1);
      return { itemId: id, kind: 'due' };
    }

    // 5. Mixed practice, weighted towards weaker items.
    let pool = knownPool.filter((id) => (this.askedCount.get(id) ?? 0) < this.askCap);
    if (pool.length < 2) {
      // Everything known has been practised enough today. If the learner is
      // doing well, an extra new item is better than drilling the same few.
      const p = this.deps.config.pacing;
      // Repeating the very same item is the one thing worse than a quick new item.
      const stuck = knownPool.every((id) => id === last);
      const room = this.introduced.length < p.maxNewPerSession && (this.sinceNew >= p.minGap || stuck);
      if (this.mode === 'daily' && room && this.pacing.allowNew()) {
        const candidate = this.nextNewCandidate();
        if (candidate) return { itemId: candidate, kind: 'new' };
      }
      while (pool.length < 2 && pool.length < knownPool.length) {
        this.askCap += 2;
        pool = knownPool.filter((id) => (this.askedCount.get(id) ?? 0) < this.askCap);
      }
    }
    const mixed = this.pickMixed(pool, last);
    if (mixed) return { itemId: mixed, kind: 'mixed' };
    return null;
  }

  /** Every introduced item (they are all in unlocked units, since units never relock). */
  private knownPool(): ItemId[] {
    const out: ItemId[] = [];
    for (const s of this.states.values()) if (s.status !== 'new') out.push(s.itemId);
    return out;
  }

  private pickMixed(pool: ItemId[], last: ItemId | undefined): ItemId | undefined {
    if (pool.length === 0) return undefined;
    const avoidN = Math.min(this.deps.config.session.avoidRecent, pool.length - 1);
    const avoid = new Set(this.recent.slice(-avoidN));
    if (last !== undefined && pool.length > 1) avoid.add(last);
    const options = pool.filter((id) => !avoid.has(id));
    const candidates = options.length ? options : pool;
    const weights = new Map(candidates.map((id) => [id, this.mixedWeight(id)]));
    return weightedPick(this.deps.rng, candidates, (id) => weights.get(id) ?? 0);
  }

  /**
   * Weaker and less recently practised items are picked more often. Items
   * asked a moment ago get a low weight: spaced retrieval beats massed
   * repetition.
   */
  private mixedWeight(id: ItemId): number {
    const s = this.state(id);
    const lastBox = this.deps.config.leitner.intervalsDays.length - 1;
    const errorRate = s.seen ? 1 - s.correct / s.seen : 0;
    let w = 1 + (lastBox - s.box) * 0.4 + errorRate * 3;
    if (s.status === 'learning') w += 1.5;
    // Close to (or past) its review day: retrieval is effortful and worth more.
    if (s.dueDay !== null) {
      const interval = this.deps.config.leitner.intervalsDays[s.box] ?? 1;
      const daysLeft = this.daysUntil(s.dueDay);
      w += 2 * Math.max(0, 1 - daysLeft / interval);
    }
    if (s.lastWrongDay === this.today) w += 1;
    const lastSeq = this.lastAskedSeq.get(id);
    const spacing = lastSeq === undefined ? 2 : Math.min(1, (this.seq - lastSeq) / 15);
    return (w * spacing) / (1 + (this.askedCount.get(id) ?? 0));
  }

  private daysUntil(day: string): number {
    let n = this.daysUntilCache.get(day);
    if (n === undefined) {
      n = diffDays(this.today, day);
      this.daysUntilCache.set(day, n);
    }
    return n;
  }

  private nextNewCandidate(): ItemId | undefined {
    let best: { id: ItemId; score: number } | undefined;
    for (const unit of sortedUnits(this.deps.pack.units)) {
      if (!this.unlocked.includes(unit.id)) continue;
      for (const id of unit.itemIds) {
        if (this.state(id).status !== 'new') continue;
        const item = this.item(id);
        // Prefer items whose mirrored twin is already known: an easy, meaningful step.
        const pairKnown = item.pairId !== undefined && this.state(item.pairId).status !== 'new';
        const score = unit.order * 1000 + item.order - (pairKnown ? 500 : 0);
        if (!best || score < best.score) best = { id, score };
      }
    }
    return best?.id;
  }

  private pickWarmup(known: ItemState[]): ItemId[] {
    const n = this.deps.config.session.warmupCount;
    const safety = (s: ItemState) => {
      const acc = s.seen ? s.correct / s.seen : 0;
      const statusBonus = s.status === 'automatic' ? 3 : s.status === 'fluent' ? 2 : 0;
      return statusBonus + s.box * 0.5 + acc * 2 - (s.lastWrongDay ? 0.5 : 0);
    };
    const safe = known.filter((s) => atLeast(s.status, 'fluent') || (s.seen >= 2 && s.correct / s.seen >= 0.8));
    const top = safe.sort((a, b) => safety(b) - safety(a)).slice(0, n * 2);
    return shuffle(this.deps.rng, top)
      .slice(0, n)
      .map((s) => s.itemId);
  }

  private sortDue(due: ItemState[]): ItemId[] {
    // Lowest box (weakest) first; random tie-break interleaves units.
    const keyed = due.map((s) => ({ id: s.itemId, key: s.box + this.deps.rng.next() * 0.9 }));
    return keyed.sort((a, b) => a.key - b.key).map((x) => x.id);
  }

  private formatFor(state: ItemState, kind: QuestionKind): AnswerFormat {
    const f = this.deps.config.format;
    if (kind === 'new' || !f.allowFree) return 'choice';
    return atLeast(state.status, f.freeFromStatus) ? 'free' : 'choice';
  }

  private item(id: ItemId): Item {
    const item = this.deps.itemById.get(id);
    if (!item) throw new Error(`Unknown item ${id}`);
    return item;
  }

  private state(id: ItemId): ItemState {
    return this.states.get(id) ?? emptyState(id);
  }
}
