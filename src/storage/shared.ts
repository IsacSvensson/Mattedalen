import { EXPORT_FORMAT, EXPORT_VERSION, parseExport, withProfileId, type ProfileExport } from './backup';
import type { ImportOptions, ProgressStore } from './ProgressStore';

/** Builds a full backup through the public store API (shared by all implementations). */
export async function exportProfile(store: ProgressStore, profileId: string, now = Date.now()): Promise<ProfileExport> {
  const profile = await store.getProfile(profileId);
  if (!profile) throw new Error(`Okänd profil: ${profileId}`);
  const progress = await store.listProgress(profileId);
  const sessions = await store.listSessions(profileId);
  const attempts = await store.listAttempts(profileId);
  const daySummaries = await store.listDaySummaries(profileId);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now,
    profile,
    progress,
    sessions,
    attempts: attempts.map(({ id: _id, ...a }) => a),
    daySummaries,
  };
}

/**
 * Validates a backup and decides where it goes. With `copy` (default) an
 * existing profile with the same id is left alone and the backup becomes a
 * new profile; with `replace` the existing one is overwritten.
 */
export async function prepareImport(
  store: ProgressStore,
  input: unknown,
  options: ImportOptions,
  newId: () => string,
): Promise<{ data: ProfileExport; replace: boolean }> {
  const data = parseExport(input);
  const existing = await store.getProfile(data.profile.id);
  if (!existing) return { data, replace: false };
  if ((options.onConflict ?? 'copy') === 'replace') return { data, replace: true };
  return { data: withProfileId(data, newId(), `${data.profile.name} (kopia)`), replace: false };
}

/**
 * Summarises the oldest part of the log once it has grown `slack` entries
 * past `keep`, so compaction runs rarely and in bulk.
 */
export async function maybeCompactLog(store: ProgressStore, profileId: string, keep: number, slack: number): Promise<number> {
  const count = await store.countAttempts(profileId);
  return count > keep + slack ? store.compactLog(profileId, keep) : 0;
}
