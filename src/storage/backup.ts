import { emptyState, type ItemState, type LearnerMeta } from '../engine';
import type { AttemptDaySummary, Profile, Progress, SessionRecord, StoredAttempt } from './types';
import { DEFAULT_SETTINGS } from './types';

export const EXPORT_FORMAT = 'gangertradgarden-profil';
export const EXPORT_VERSION = 1;

/** Full JSON backup of one profile. */
export interface ProfileExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  profile: Profile;
  progress: Progress[];
  sessions: SessionRecord[];
  attempts: StoredAttempt[];
  daySummaries: AttemptDaySummary[];
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * Upgrades older export versions step by step. Add an entry `n: (data) => …`
 * that converts version n to n + 1 whenever the format changes.
 */
const EXPORT_MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
const num = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const str = (x: unknown, fallback: string) => (typeof x === 'string' ? x : fallback);

function sanitizeItemState(id: string, raw: unknown): ItemState {
  const base = emptyState(id);
  if (!isObject(raw)) return base;
  const status = ['new', 'learning', 'fluent', 'automatic'].includes(raw.status as string) ? (raw.status as ItemState['status']) : 'new';
  return {
    ...base,
    status,
    box: Math.max(0, Math.floor(num(raw.box, 0))),
    dueDay: typeof raw.dueDay === 'string' ? raw.dueDay : null,
    introducedDay: typeof raw.introducedDay === 'string' ? raw.introducedDay : null,
    lastSeenAt: typeof raw.lastSeenAt === 'number' ? raw.lastSeenAt : null,
    lastWrongDay: typeof raw.lastWrongDay === 'string' ? raw.lastWrongDay : null,
    lastRtMs: typeof raw.lastRtMs === 'number' ? raw.lastRtMs : null,
    seen: num(raw.seen, 0),
    correct: num(raw.correct, 0),
    lapses: num(raw.lapses, 0),
    dayBest: isObject(raw.dayBest) ? (raw.dayBest as ItemState['dayBest']) : {},
    confusions: isObject(raw.confusions) ? (raw.confusions as ItemState['confusions']) : {},
    ...(typeof raw.wrongDays === 'number' ? { wrongDays: num(raw.wrongDays, 0) } : {}),
    ...(typeof raw.drops === 'number' ? { drops: num(raw.drops, 0) } : {}),
    ...(typeof raw.supportDay === 'string' ? { supportDay: raw.supportDay } : {}),
    ...(typeof raw.settledDay === 'string' ? { settledDay: raw.settledDay } : {}),
  };
}

function sanitizeMeta(raw: unknown): LearnerMeta {
  const m = isObject(raw) ? raw : {};
  return {
    pacingGap: num(m.pacingGap, 8),
    unlockedUnitIds: isArray(m.unlockedUnitIds) ? m.unlockedUnitIds.filter((x): x is string => typeof x === 'string') : [],
    accuracyEma: typeof m.accuracyEma === 'number' ? m.accuracyEma : null,
    sessionsCompleted: num(m.sessionsCompleted, 0),
    lastSessionDay: typeof m.lastSessionDay === 'string' ? m.lastSessionDay : null,
    ...(isObject(m.today) && typeof m.today.day === 'string'
      ? { today: { day: m.today.day, practisedMs: num(m.today.practisedMs, 0), introduced: num(m.today.introduced, 0) } }
      : {}),
  };
}

function sanitizeProfile(raw: unknown): Profile {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    throw new ImportError('Filen saknar en giltig profil.');
  }
  const settings = isObject(raw.settings) ? raw.settings : {};
  return {
    id: raw.id,
    name: raw.name.slice(0, 40),
    avatar: str(raw.avatar, '🌱'),
    createdAt: num(raw.createdAt, 0),
    settings: {
      sessionMinutes: num(settings.sessionMinutes, DEFAULT_SETTINGS.sessionMinutes),
      readAloud: typeof settings.readAloud === 'boolean' ? settings.readAloud : DEFAULT_SETTINGS.readAloud,
      allowFree: typeof settings.allowFree === 'boolean' ? settings.allowFree : DEFAULT_SETTINGS.allowFree,
    },
  };
}

/** Validates and normalizes an export (parsed JSON or a JSON string). */
export function parseExport(input: unknown): ProfileExport {
  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      throw new ImportError('Filen är inte en giltig JSON-fil.');
    }
  }
  if (!isObject(data) || data.format !== EXPORT_FORMAT) throw new ImportError('Filen är inte en export från Gångerträdgården.');
  let version = num(data.version, 0);
  if (version > EXPORT_VERSION) throw new ImportError('Filen kommer från en nyare version av appen. Uppdatera appen och försök igen.');
  let d: Record<string, unknown> = data;
  while (version < EXPORT_VERSION) {
    const migrate = EXPORT_MIGRATIONS[version];
    if (!migrate) throw new ImportError(`Exportversion ${version} stöds inte.`);
    d = migrate(d);
    version++;
  }
  const profile = sanitizeProfile(d.profile);
  const progress = (isArray(d.progress) ? d.progress : []).filter(isObject).map(
    (p): Progress => ({
      profileId: profile.id,
      packId: str(p.packId, 'multiplication'),
      packVersion: num(p.packVersion, 1),
      states: Object.fromEntries(
        Object.entries(isObject(p.states) ? p.states : {}).map(([id, s]) => [id, sanitizeItemState(id, s)]),
      ),
      meta: sanitizeMeta(p.meta),
      updatedAt: num(p.updatedAt, 0),
    }),
  );
  const list = <T>(x: unknown, ok: (v: Record<string, unknown>) => boolean) =>
    (isArray(x) ? x : []).filter((v): v is Record<string, unknown> => isObject(v) && ok(v)).map((v) => ({ ...v, profileId: profile.id }) as T);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: num(d.exportedAt, 0),
    profile,
    progress,
    sessions: list<SessionRecord>(d.sessions, (v) => typeof v.id === 'string' && typeof v.startedAt === 'number'),
    attempts: list<StoredAttempt>(d.attempts, (v) => typeof v.itemId === 'string' && typeof v.ts === 'number').map((a) => {
      const { id: _id, ...rest } = a;
      return rest;
    }),
    daySummaries: list<AttemptDaySummary>(d.daySummaries, (v) => typeof v.itemId === 'string' && typeof v.day === 'string'),
  };
}

/** Re-targets a backup to another profile id (used when importing as a copy). */
export function withProfileId(data: ProfileExport, id: string, name = data.profile.name): ProfileExport {
  const re = <T extends { profileId: string }>(xs: T[]) => xs.map((x) => ({ ...x, profileId: id }));
  return {
    ...data,
    profile: { ...data.profile, id, name },
    progress: re(data.progress),
    sessions: re(data.sessions),
    attempts: re(data.attempts),
    daySummaries: re(data.daySummaries),
  };
}

export function exportFileName(profile: Profile, now = new Date()): string {
  const slug =
    profile.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'profil';
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `gangertradgarden-${slug}-${day}.json`;
}
