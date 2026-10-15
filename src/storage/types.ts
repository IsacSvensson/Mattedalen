import type { Attempt, DayKey, ItemId, ItemState, LearnerMeta } from '../engine';

export interface ProfileSettings {
  /** Length of the daily session in minutes (10–15). */
  sessionMinutes: number;
  /** Read questions aloud (Web Speech API, sv-SE). */
  readAloud: boolean;
  /** Allow free-input answers (number pad) for fluent facts. */
  allowFree: boolean;
  /**
   * A grown-up has opened Trädgården, or the child came from Gångerträdgården.
   * Otherwise the garden opens when doubles and going over ten sit at the brook.
   */
  gardenOpen?: boolean;
}

export const DEFAULT_SETTINGS: ProfileSettings = {
  sessionMinutes: 12,
  readAloud: false,
  allowFree: true,
};

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  settings: ProfileSettings;
}

/** Learning progress of one profile in one content pack. */
export interface Progress {
  profileId: string;
  packId: string;
  packVersion: number;
  states: Record<ItemId, ItemState>;
  meta: LearnerMeta;
  updatedAt: number;
}

export interface StoredAttempt extends Attempt {
  profileId: string;
  packId: string;
  /** Assigned by the store. */
  id?: number;
}

/** One finished (or abandoned) session, kept indefinitely (it is tiny). */
export interface SessionRecord {
  id: string;
  profileId: string;
  packId: string;
  mode: 'daily' | 'extra' | 'focus' | 'challenge' | 'duel' | 'placement' | 'check';
  day: DayKey;
  startedAt: number;
  endedAt: number;
  answered: number;
  correct: number;
  introduced: ItemId[];
  /** Focus set practised (focus sessions, and challenges limited to one set). */
  focusId?: string;
  /** Free-form result data, e.g. a challenge score. */
  extra?: Record<string, number>;
}

/** Aggregate of older attempts that were removed from the log. */
export interface AttemptDaySummary {
  profileId: string;
  packId: string;
  day: DayKey;
  itemId: ItemId;
  attempts: number;
  correct: number;
  totalRtMs: number;
}
