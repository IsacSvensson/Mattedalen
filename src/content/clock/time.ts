/**
 * Clock times and their Swedish words (docs/PLAN-KLOCKAN.md). A time is read
 * on a 12-hour clock here, written "3:30"; the 24-hour clock comes later (KL6).
 */
export interface Time {
  /** 1–12. */
  h: number;
  /** 0–59. */
  m: number;
}

const HOURS = ['tolv', 'ett', 'två', 'tre', 'fyra', 'fem', 'sex', 'sju', 'åtta', 'nio', 'tio', 'elva', 'tolv'];

/** "tre" for 3; 0 and 12 are both "tolv". */
export const hourName = (h: number) => HOURS[((h % 12) + 12) % 12 === 0 ? 12 : ((h % 12) + 12) % 12]!;

/** The hour after `h` on the face: after 12 comes 1. */
export const nextHour = (h: number) => (h % 12) + 1;
/** The hour before: before 1 comes 12. */
export const prevHour = (h: number) => (h === 1 ? 12 : h - 1);

/** What a clock looks like, so the child learns to read any clock (drawn by `clockFace`). */
export type ClockLook = 'plain' | 'kitchen' | 'watch' | 'station';
export const CLOCK_LOOKS: readonly ClockLook[] = ['plain', 'kitchen', 'watch', 'station'];

/** "3:30". */
export const formatClock = (t: Time) => `${t.h}:${String(t.m).padStart(2, '0')}`;

/** "3:30", "03:30" or "3.30" as a time; null when it is not one. */
export function parseClock(text: string): Time | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min > 59) return null;
  return { h: h % 12 === 0 ? 12 : h % 12, m: min };
}

/** Where the hour hand stands, in hours: it moves on with the minutes (3.5 at half past three). */
export const hourHandAt = (t: Time) => (t.h % 12) + t.m / 60;

/**
 * The time in words, for whole, half and quarter hours (steps 3–4):
 * "tre", "halv fyra" (3:30: halfway to four), "kvart över tre", "kvart i fyra".
 * Null for other minutes: those words come with the Swedish phrases (KL5).
 */
export function phrase(t: Time): string | null {
  switch (t.m) {
    case 0:
      return hourName(t.h);
    case 15:
      return `kvart över ${hourName(t.h)}`;
    case 30:
      return `halv ${hourName(nextHour(t.h))}`;
    case 45:
      return `kvart i ${hourName(nextHour(t.h))}`;
    default:
      return null;
  }
}

/** Times as answers, words in lower case with single spaces, and numbers as numbers. */
export function normalizeAnswer(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  const t = parseClock(s);
  if (t) return formatClock(t);
  return /^\d+$/.test(s) ? String(Number.parseInt(s, 10)) : s;
}
