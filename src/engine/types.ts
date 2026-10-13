/**
 * Core data model of the learning engine.
 *
 * The engine is content-agnostic: an Item is just a prompt with one correct
 * answer. Everything subject specific (how prompts look, which wrong answers
 * are plausible, which strategy hints exist) lives in a ContentPack.
 */

export type ItemId = string;
export type UnitId = string;
/** Local calendar day, formatted `YYYY-MM-DD`. */
export type DayKey = string;

export type Status = 'new' | 'learning' | 'fluent' | 'automatic';
export const STATUS_ORDER: readonly Status[] = ['new', 'learning', 'fluent', 'automatic'];

export type AnswerFormat = 'choice' | 'free';

/**
 * Opaque hint attached to an item. The engine only passes hints through;
 * the content pack defines the kinds and the game renders them.
 */
export interface Hint {
  kind: string;
  text?: string;
  data?: unknown;
}

export interface Item {
  id: ItemId;
  /** Display text of the question. */
  prompt: string;
  /** Canonical correct answer (compared after `ContentPack.normalizeAnswer`). */
  answer: string;
  unitId: UnitId;
  tags: string[];
  /** Items this one can be derived from (used for strategy feedback). */
  derivedFrom: ItemId[];
  hints: Hint[];
  /** Mirrored twin item (e.g. a reversed form), if any. */
  pairId?: ItemId;
  /** Introduction order within the unit; lower is introduced first. */
  order: number;
}

export type UnlockRule =
  | { kind: 'always' }
  /** Unlocked when `fraction` of the previous unit's items are at least `minStatus`. */
  | { kind: 'previous'; fraction: number; minStatus: Status };

export interface Unit {
  id: UnitId;
  title: string;
  itemIds: ItemId[];
  order: number;
  unlockRule: UnlockRule;
}

/**
 * A named group of items that can be practised on purpose (e.g. one table in
 * an arithmetic pack). It may cut across units: an item belongs to one unit but can be in
 * several focus sets.
 */
export interface FocusSet {
  id: string;
  title: string;
  itemIds: ItemId[];
}

export interface DistractorCandidate {
  value: string;
  /** Relative plausibility; higher is picked more often. */
  weight: number;
}

export interface ContentPack {
  id: string;
  version: number;
  title: string;
  items: Item[];
  units: Unit[];
  normalizeAnswer(raw: string): string;
  /** Plausible wrong answers for multiple choice. Must not include the correct answer. */
  distractorCandidates(item: Item): DistractorCandidate[];
  /** Groups the learner can choose to practise extra (optional). */
  focusSets?: FocusSet[];
}

/** Best correct response time (ms) per answer format on one day. */
export type DayEvidence = Partial<Record<AnswerFormat, number>>;

export interface ItemState {
  itemId: ItemId;
  status: Status;
  /** Leitner box index into `config.leitner.intervalsDays`. */
  box: number;
  /** Day the item is due for spaced review; null while new. */
  dueDay: DayKey | null;
  introducedDay: DayKey | null;
  lastSeenAt: number | null;
  lastWrongDay: DayKey | null;
  lastRtMs: number | null;
  seen: number;
  correct: number;
  lapses: number;
  /**
   * Fast-correct evidence per day. Status promotions are derived from this,
   * which lets both thresholds (fluent/automatic) be reconfigured freely.
   */
  dayBest: Record<DayKey, DayEvidence>;
  /** Wrong answers given (normalized) → count. */
  confusions: Record<string, number>;
}

export type QuestionKind = 'warmup' | 'new' | 'rehearse' | 'retry' | 'due' | 'mixed' | 'placement';

export interface Attempt {
  itemId: ItemId;
  ts: number;
  sessionId: string;
  format: AnswerFormat;
  kind: QuestionKind;
  given: string;
  correct: boolean;
  rtMs: number;
}

/** Engine state that persists between sessions for one learner. */
export interface LearnerMeta {
  /** Known items asked between two new items (adapted towards the target accuracy). */
  pacingGap: number;
  unlockedUnitIds: UnitId[];
  /** Exponential moving average of session accuracy, null before the first session. */
  accuracyEma: number | null;
  /** Number of daily sessions finished. */
  sessionsCompleted: number;
  lastSessionDay: DayKey | null;
}

export interface StatusConfig {
  fluentRtMs: number;
  fluentDays: number;
  fluentFormats: AnswerFormat[];
  automaticRtMs: number;
  automaticDays: number;
  automaticFormats: AnswerFormat[];
  /** How many days of evidence to keep per item. */
  keepEvidenceDays: number;
}

export interface EngineConfig {
  status: StatusConfig;
  leitner: { intervalsDays: number[] };
  session: {
    durationMs: number;
    warmupCount: number;
    /** Questions until a wrongly answered item is asked again. */
    retryGap: number;
    maxRetriesPerItem: number;
    /** Gaps (in questions) at which a newly introduced item is rehearsed. */
    rehearsalGaps: number[];
    /** Do not repeat any of the last N items (when the pool allows). */
    avoidRecent: number;
    /** Soft limit on how often one item is asked in mixed practice per session. */
    maxAsksPerItem: number;
  };
  pacing: {
    targetLow: number;
    targetHigh: number;
    /** Size of the rolling window of answers used for pacing decisions. */
    window: number;
    initialGap: number;
    minGap: number;
    maxGap: number;
    maxNewPerSession: number;
    /** New items allowed when the learner knows nothing yet. */
    bootstrapNew: number;
    /** One extra new item per this many known items at session start. */
    knownPerNew: number;
    /** Unlock fraction used instead of the unit rule while the learner is above `targetHigh`. */
    easyUnlockFraction: number;
  };
  focus: {
    /** Share of questions taken from the chosen focus set (the rest keeps practice mixed). */
    share: number;
    /** New items a focus session may introduce from the set. */
    maxNew: number;
  };
  format: {
    allowFree: boolean;
    /** Items at or above this status are asked with free input. */
    freeFromStatus: Status;
    choiceCount: number;
  };
}
