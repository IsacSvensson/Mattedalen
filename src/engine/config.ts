import type { EngineConfig, LearnerMeta } from './types';

export const DEFAULT_CONFIG: EngineConfig = {
  status: {
    // fluent = correct under 5 s on 2 different days (any format)
    fluentRtMs: 5000,
    fluentDays: 2,
    fluentFormats: ['choice', 'free'],
    // automatic = correct under 4 s on 3 different days, recalled without options
    // (3 s and 10 days of evidence gave the average simulated child no trees in a
    // year: a fluent fact comes back every 4–30 days; docs/PLAN-GRANSKNING.md, S2)
    automaticRtMs: 4000,
    automaticDays: 3,
    automaticFormats: ['free'],
    keepEvidenceDays: 30,
  },
  leitner: { intervalsDays: [1, 2, 4, 7, 14, 30] },
  session: {
    durationMs: 12 * 60_000,
    warmupCount: 5,
    retryGap: 3,
    maxRetriesPerItem: 2,
    rehearsalGaps: [2, 5, 10],
    avoidRecent: 3,
    maxAsksPerItem: 5,
  },
  pacing: {
    targetLow: 0.8,
    targetHigh: 0.9,
    window: 10,
    initialGap: 8,
    minGap: 3,
    maxGap: 14,
    maxNewPerSession: 12,
    bootstrapNew: 3,
    knownPerNew: 4,
    easyUnlockFraction: 0.6,
  },
  // Hard items are reached in steps from known ones (derived facts), then
  // asked again from memory a few questions later.
  support: {
    wrongDays: 2,
    drops: 2,
    stuckDays: 7,
    maxPerSession: 3,
  },
  // Focus practice: mostly the chosen set, but interleaved with other known
  // items (blocked practice feels effective but is retained worse).
  focus: {
    share: 0.7,
    maxNew: 6,
    minKnown: 4,
  },
  format: {
    allowFree: true,
    freeFromStatus: 'fluent',
    choiceCount: 4,
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };
export type ConfigOverrides = DeepPartial<EngineConfig>;

/** Defaults with the overrides applied in order (later ones win), e.g. the pack's, then the game's. */
export function makeConfig(...layers: ConfigOverrides[]): EngineConfig {
  const merged = (key: keyof EngineConfig) => Object.assign({}, DEFAULT_CONFIG[key], ...layers.map((l) => l[key]));
  return {
    status: merged('status'),
    leitner: merged('leitner'),
    session: merged('session'),
    pacing: merged('pacing'),
    support: merged('support'),
    focus: merged('focus'),
    format: merged('format'),
  } as EngineConfig;
}

export function initialLearnerMeta(config: EngineConfig, firstUnitIds: string[]): LearnerMeta {
  return {
    pacingGap: config.pacing.initialGap,
    unlockedUnitIds: firstUnitIds,
    accuracyEma: null,
    sessionsCompleted: 0,
    lastSessionDay: null,
  };
}
