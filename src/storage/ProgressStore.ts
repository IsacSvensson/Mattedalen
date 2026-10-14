import type { AttemptDaySummary, Profile, Progress, SessionRecord, StoredAttempt } from './types';
import type { ProfileExport } from './backup';

export interface ImportOptions {
  /**
   * What to do if a profile with the same id already exists:
   * `replace` overwrites it (moving a child's progress to this device),
   * `copy` imports it as a new profile next to the existing one.
   */
  onConflict?: 'replace' | 'copy';
}

export interface AttemptQuery {
  packId?: string;
  /** Inclusive lower bound on `ts`. */
  since?: number;
  limit?: number;
}

/**
 * Persistence boundary for the game. The engine never sees this; the game
 * loads progress, runs a session and stores the results. A backend could
 * implement the same interface later without touching the engine or game.
 */
export interface ProgressStore {
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | undefined>;
  saveProfile(profile: Profile): Promise<void>;
  /** Deletes the profile with all its progress, sessions and log. */
  deleteProfile(id: string): Promise<void>;

  load(profileId: string, packId: string): Promise<Progress | undefined>;
  save(progress: Progress): Promise<void>;
  /** All progress records of a profile (one per content pack). */
  listProgress(profileId: string): Promise<Progress[]>;

  appendAttempt(attempt: StoredAttempt): Promise<void>;
  listAttempts(profileId: string, query?: AttemptQuery): Promise<StoredAttempt[]>;
  countAttempts(profileId: string): Promise<number>;
  listDaySummaries(profileId: string): Promise<AttemptDaySummary[]>;
  /**
   * Keeps the newest `keep` attempts of the profile and folds older ones into
   * per-day summaries. Returns the number of attempts removed.
   */
  compactLog(profileId: string, keep: number): Promise<number>;

  saveSession(session: SessionRecord): Promise<void>;
  listSessions(profileId: string): Promise<SessionRecord[]>;

  /** Full backup of one profile, including the log. */
  export(profileId: string): Promise<ProfileExport>;
  /** Restores a backup. Returns the imported profile (with its possibly new id). */
  import(data: ProfileExport, options?: ImportOptions): Promise<Profile>;

  /** Small app-wide key/value settings (parent PIN, last profile, …). */
  getSetting<T>(key: string): Promise<T | undefined>;
  setSetting<T>(key: string, value: T): Promise<void>;
}

/** Default size of the attempt log per profile before older entries are summarised. */
export const DEFAULT_LOG_KEEP = 3000;
/** Compact only when this many attempts above `keep` have accumulated. */
export const LOG_COMPACT_SLACK = 500;
