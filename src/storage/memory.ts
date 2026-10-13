import { exportProfile, prepareImport } from './shared';
import type { AttemptQuery, ImportOptions, ProgressStore } from './ProgressStore';
import type { ProfileExport } from './backup';
import { summarizeAttempts } from './compact';
import type { AttemptDaySummary, Profile, Progress, SessionRecord, StoredAttempt } from './types';

const clone = <T>(x: T): T => structuredClone(x);

/**
 * In-memory ProgressStore. Used in tests and as a fallback when IndexedDB is
 * unavailable (progress then lasts only until the page is closed).
 */
export class MemoryProgressStore implements ProgressStore {
  private profiles = new Map<string, Profile>();
  private progress = new Map<string, Progress>();
  private attempts: StoredAttempt[] = [];
  private sessions = new Map<string, SessionRecord>();
  private summaries: AttemptDaySummary[] = [];
  private settings = new Map<string, unknown>();
  private nextAttemptId = 1;

  constructor(private readonly newId: () => string = () => crypto.randomUUID()) {}

  async listProfiles() {
    return [...this.profiles.values()].map(clone).sort((a, b) => a.createdAt - b.createdAt);
  }
  async getProfile(id: string) {
    const p = this.profiles.get(id);
    return p && clone(p);
  }
  async saveProfile(profile: Profile) {
    this.profiles.set(profile.id, clone(profile));
  }
  async deleteProfile(id: string) {
    this.profiles.delete(id);
    for (const key of [...this.progress.keys()]) if (key.startsWith(`${id}|`)) this.progress.delete(key);
    for (const key of [...this.sessions.keys()]) if (key.startsWith(`${id}|`)) this.sessions.delete(key);
    this.attempts = this.attempts.filter((a) => a.profileId !== id);
    this.summaries = this.summaries.filter((s) => s.profileId !== id);
  }

  async load(profileId: string, packId: string) {
    const p = this.progress.get(`${profileId}|${packId}`);
    return p && clone(p);
  }
  async save(progress: Progress) {
    this.progress.set(`${progress.profileId}|${progress.packId}`, clone(progress));
  }

  async listProgress(profileId: string) {
    return [...this.progress.values()].filter((p) => p.profileId === profileId).map(clone);
  }

  async appendAttempt(attempt: StoredAttempt) {
    this.attempts.push({ ...clone(attempt), id: this.nextAttemptId++ });
  }
  async listAttempts(profileId: string, query: AttemptQuery = {}) {
    let out = this.attempts.filter(
      (a) => a.profileId === profileId && (query.packId === undefined || a.packId === query.packId) && a.ts >= (query.since ?? -Infinity),
    );
    out = out.sort((a, b) => a.ts - b.ts || (a.id ?? 0) - (b.id ?? 0));
    if (query.limit !== undefined) out = out.slice(-query.limit);
    return out.map(clone);
  }
  async countAttempts(profileId: string) {
    return this.attempts.filter((a) => a.profileId === profileId).length;
  }
  async listDaySummaries(profileId: string) {
    return this.summaries.filter((s) => s.profileId === profileId).map(clone);
  }
  async compactLog(profileId: string, keep: number) {
    const mine = await this.listAttempts(profileId);
    const old = mine.slice(0, Math.max(0, mine.length - keep));
    if (old.length === 0) return 0;
    const removed = new Set(old.map((a) => a.id));
    const others = this.summaries.filter((s) => s.profileId !== profileId);
    this.summaries = [...others, ...summarizeAttempts(old, await this.listDaySummaries(profileId))];
    this.attempts = this.attempts.filter((a) => !removed.has(a.id));
    return old.length;
  }

  async saveSession(session: SessionRecord) {
    this.sessions.set(`${session.profileId}|${session.id}`, clone(session));
  }
  async listSessions(profileId: string) {
    return [...this.sessions.values()]
      .filter((s) => s.profileId === profileId)
      .sort((a, b) => a.startedAt - b.startedAt)
      .map(clone);
  }

  async export(profileId: string) {
    return exportProfile(this, profileId);
  }

  async import(input: ProfileExport, options: ImportOptions = {}) {
    const { data, replace } = await prepareImport(this, input, options, this.newId);
    if (replace) await this.deleteProfile(data.profile.id);
    await this.saveProfile(data.profile);
    for (const p of data.progress) await this.save(p);
    for (const s of data.sessions) await this.saveSession(s);
    for (const a of data.attempts) await this.appendAttempt(a);
    this.summaries.push(...data.daySummaries.map(clone));
    return clone(data.profile);
  }

  async getSetting<T>(key: string) {
    return clone(this.settings.get(key)) as T | undefined;
  }
  async setSetting<T>(key: string, value: T) {
    this.settings.set(key, clone(value));
  }
}
