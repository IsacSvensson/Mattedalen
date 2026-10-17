import type { ItemState, LearnerMeta } from '../engine';
import type { ProfileExport } from './backup';
import type { AttemptDaySummary, ProfileSettings, SessionRecord, StoredAttempt } from './types';

/**
 * The file for the pilot (docs/PLAN-PILOT.md): one child's answers and
 * progress under a pilot code, without the name, the animal or the profile's
 * id. Everything in it is picked field by field (an allow-list), so that a new
 * field in the profile never ends up in the file by mistake. The file is saved
 * on the device; a grown-up chooses whether to send it.
 */
export const PILOT_FORMAT = 'mattedalen-pilot';
export const PILOT_VERSION = 1;

export interface PilotExport {
  format: typeof PILOT_FORMAT;
  version: number;
  /** The app's build, as under "Den här enheten". */
  app: string;
  exportedAt: number;
  code: string;
  settings: Partial<ProfileSettings>;
  places: {
    packId: string;
    packVersion: number;
    meta: Pick<LearnerMeta, 'unlockedUnitIds' | 'sessionsCompleted' | 'accuracyEma' | 'pacingGap' | 'lastSessionDay'>;
    items: Record<string, Partial<ItemState>>;
  }[];
  sessions: Omit<SessionRecord, 'profileId'>[];
  attempts: Omit<StoredAttempt, 'profileId' | 'id'>[];
  daySummaries: Omit<AttemptDaySummary, 'profileId'>[];
}

/** A pilot code: letters, digits and dashes, at most 12, in capitals ("p03" is "P03"). Null if it is not one. */
export function pilotCode(text: string): string | null {
  const code = text.trim().toUpperCase();
  return /^[A-Z0-9-]{1,12}$/.test(code) ? code : null;
}

export function pilotFileName(code: string, now = new Date()): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `mattedalen-pilot-${code}-${day}.json`;
}

const pick = <T extends object, K extends keyof T>(from: T, keys: readonly K[]): Pick<T, K> => {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (from[k] !== undefined) out[k] = from[k];
  return out;
};

const SETTINGS = ['sessionMinutes', 'readAloud', 'allowFree', 'moreTime', 'gardenOpen', 'pathOpen', 'tablesWait', 'tableReady', 'divisionSign'] as const;
const ITEM = [
  'status',
  'box',
  'dueDay',
  'introducedDay',
  'seen',
  'correct',
  'lapses',
  'lastWrongDay',
  'wrongDays',
  'drops',
  'peak',
  'supportDay',
  'settledDay',
  'dayBest',
  'confusions',
] as const;
const META = ['unlockedUnitIds', 'sessionsCompleted', 'accuracyEma', 'pacingGap', 'lastSessionDay'] as const;
const SESSION = ['id', 'packId', 'mode', 'day', 'startedAt', 'endedAt', 'answered', 'correct', 'introduced', 'focusId', 'extra'] as const;
const ATTEMPT = ['packId', 'itemId', 'ts', 'sessionId', 'format', 'kind', 'given', 'correct', 'rtMs', 'variant'] as const;
const SUMMARY = ['packId', 'day', 'itemId', 'attempts', 'correct', 'totalRtMs'] as const;

/** The pilot's file, from a child's full backup (`ProgressStore.export`). Facts never asked are left out. */
export function pilotExport(data: ProfileExport, code: string, app: string, now = Date.now()): PilotExport {
  return {
    format: PILOT_FORMAT,
    version: PILOT_VERSION,
    app,
    exportedAt: now,
    code,
    settings: pick(data.profile.settings, SETTINGS),
    places: data.progress.map((p) => ({
      packId: p.packId,
      packVersion: p.packVersion,
      meta: pick(p.meta, META),
      items: Object.fromEntries(Object.entries(p.states).filter(([, s]) => s.status !== 'new' || s.seen > 0).map(([id, s]) => [id, pick(s, ITEM)])),
    })),
    sessions: data.sessions.map((s) => pick(s, SESSION)),
    attempts: data.attempts.map((a) => pick(a, ATTEMPT)),
    daySummaries: (data.daySummaries ?? []).map((d) => pick(d, SUMMARY)),
  };
}
