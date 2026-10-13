import type { DayKey } from './types';

/** Injected time source. `today()` decides where day boundaries fall. */
export interface Clock {
  now(): number;
  today(): DayKey;
}

/** Injected randomness: uniform float in [0, 1). */
export interface Rng {
  next(): number;
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export function formatDay(year: number, month: number, day: number): DayKey {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function dayToUtcMs(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: DayKey, n: number): DayKey {
  const date = new Date(dayToUtcMs(day) + n * 86_400_000);
  return formatDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((dayToUtcMs(b) - dayToUtcMs(a)) / 86_400_000);
}

/** Clock using the device's local calendar. */
export const systemClock: Clock = {
  now: () => Date.now(),
  today: () => {
    const d = new Date();
    return formatDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
  },
};

/** Manually advanced clock for tests and simulations. Days follow UTC. */
export class ManualClock implements Clock {
  constructor(private ms: number) {}
  now(): number {
    return this.ms;
  }
  today(): DayKey {
    const d = new Date(this.ms);
    return formatDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  advance(ms: number): void {
    this.ms += ms;
  }
  set(ms: number): void {
    this.ms = ms;
  }
}

/** Small, fast, seedable PRNG (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export const mathRandomRng: Rng = { next: () => Math.random() };

export function randInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng.next() * maxExclusive);
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Pick one element with probability proportional to its weight. */
export function weightedPick<T>(rng: Rng, list: readonly T[], weight: (x: T) => number): T | undefined {
  let total = 0;
  for (const x of list) total += Math.max(0, weight(x));
  if (total <= 0) return list.length ? list[randInt(rng, list.length)] : undefined;
  let r = rng.next() * total;
  for (const x of list) {
    r -= Math.max(0, weight(x));
    if (r < 0) return x;
  }
  return list[list.length - 1];
}

export function randomId(rng: Rng): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += Math.floor(rng.next() * 0x10000).toString(16).padStart(4, '0');
  return s;
}
