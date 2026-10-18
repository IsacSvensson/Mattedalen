/**
 * Back to the same screen after an update (docs/PLAN-UPPDATERING.md, U1). A new
 * version is taken into use by reloading the page, and the app would start
 * over at "Vem spelar?". Each screen says where it is; just before a reload for
 * an update, that is kept in sessionStorage, which lasts through a reload in
 * the same tab but not past closing the app. An ordinary start begins as before.
 */
export type ParentPage = 'overview' | 'place' | 'settings' | 'device' | 'import' | 'feedback' | 'news' | 'pilot';

export type Where =
  | { kind: 'valley'; profileId: string }
  | { kind: 'place'; profileId: string; placeId: string }
  | { kind: 'parent'; page: ParentPage; profileId?: string; placeId?: string };

const KEY = 'mattedalen:resume';

/** A reload later than this after the mark starts over: it was not the update's. */
export const RESUME_WITHIN_MS = 5 * 60_000;

const PARENT_PAGES: readonly string[] = ['overview', 'place', 'settings', 'device', 'import', 'feedback', 'news', 'pilot'];

let where: Where | null = null;

/** Called by each screen as it is shown; null where there is nothing to come back to (the list of players). */
export function setWhere(next: Where | null): void {
  where = next;
}

/** Just before the page reloads into a new version: come back here. */
export function markResume(now = Date.now()): void {
  if (!where) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ where, at: now }));
  } catch {
    // Without sessionStorage the app starts over, as before.
  }
}

/** Where to come back to after an update's reload, once; null for an ordinary start. */
export function takeResume(now = Date.now()): Where | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const { where: w, at } = JSON.parse(raw) as { where?: unknown; at?: unknown };
    if (typeof at !== 'number' || now < at || now - at > RESUME_WITHIN_MS) return null;
    return isWhere(w) ? w : null;
  } catch {
    return null;
  }
}

const text = (v: unknown) => typeof v === 'string' && v.length > 0;

function isWhere(w: unknown): w is Where {
  if (typeof w !== 'object' || w === null) return false;
  const x = w as Record<string, unknown>;
  if (x.kind === 'valley') return text(x.profileId);
  if (x.kind === 'place') return text(x.profileId) && text(x.placeId);
  if (x.kind === 'parent') return PARENT_PAGES.includes(x.page as string) && (x.profileId === undefined || text(x.profileId));
  return false;
}
