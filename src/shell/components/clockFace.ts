import { prefersReducedMotion, s } from '../dom';

/**
 * A clock face (docs/PLAN-KLOCKAN.md): the numbers 1–12, a mark for every
 * minute, the minute hand and the hour hand. The hour hand always stands
 * where the time is (at 3:30 halfway between 3 and 4, never on 3). The
 * garden's picture for ×5 leaves the hour hand out, so it shows no time that
 * can be read wrong; a clock with only the hour hand leaves the minute hand out.
 */
export interface ClockFaceOptions {
  /** Where the minute hand stands, 0–60 (60 is a whole turn, on 12). No minute hand when left out. */
  minute?: number;
  /** The hour, with the minutes as a fraction (3.5 at half past three). No hour hand when left out. */
  hour?: number;
  /** The minutes 5–60 around the edge, and an arc from 12 to the minute hand. */
  minuteRing?: boolean;
  /** The quarters of the face in two tones: half and quarter turns. */
  quarters?: boolean;
  /** The numbers 1–12 (default); without them only the marks. */
  numbers?: boolean;
  /** What the clock looks like, so the child learns to read any clock. */
  look?: ClockLook;
  /** The minute hand hops from 12, five minutes at a time, and each number it passes lights up. */
  hop?: boolean;
  /** What the picture shows, for screen readers. */
  label: string;
}

export type ClockLook = 'plain' | 'kitchen' | 'watch' | 'station';
export const CLOCK_LOOKS: readonly ClockLook[] = ['plain', 'kitchen', 'watch', 'station'];

/** The face's centre and size, in the picture's own units (a 140 × 140 view). */
export const C = 70;
export const FACE = 50;
const RING = 62;
/** Time between two hops of the minute hand. */
export const HOP_STEP_MS = 320;

export const point = (minute: number, r: number) => {
  const a = (minute / 60) * 2 * Math.PI;
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
};
const fmt = (n: number) => n.toFixed(2);

/** The angle of the minute hand in degrees, clockwise from 12. */
export const minuteAngle = (minute: number) => (minute / 60) * 360;
/** The angle of the hour hand in degrees: it moves on with the minutes, 30° an hour. */
export const hourAngle = (hour: number) => ((hour % 12) / 12) * 360;

/** The arc from 12 to `minute`, just outside the face. */
function arcPath(minute: number): string {
  if (minute <= 0) return '';
  if (minute >= 60) return `M${C} ${C - 55} A55 55 0 1 1 ${C - 0.01} ${C - 55}`;
  const end = point(minute, 55);
  return `M${C} ${C - 55} A55 55 0 ${minute > 30 ? 1 : 0} 1 ${fmt(end.x)} ${fmt(end.y)}`;
}

/** One quarter of the face, from `from` to `from + 15` minutes. */
function quarterPath(from: number): string {
  const a = point(from, FACE);
  const b = point(from + 15, FACE);
  return `M${C} ${C} L${fmt(a.x)} ${fmt(a.y)} A${FACE} ${FACE} 0 0 1 ${fmt(b.x)} ${fmt(b.y)} Z`;
}

export const handTransform = (deg: number) => `rotate(${fmt(deg)} ${C} ${C})`;

export function clockFace(opts: ClockFaceOptions): SVGSVGElement {
  const { minute, hour, minuteRing = false, quarters = false, numbers = true, look = 'plain', hop = false, label } = opts;
  const parts: SVGElement[] = [];
  // The watch's strap, behind the face.
  if (look === 'watch') parts.push(s('rect', { class: 'clock-strap', x: C - 22, y: 2, width: 44, height: 136, rx: 10 }));
  const arc = minuteRing && minute !== undefined ? s('path', { class: 'clock-arc', d: arcPath(minute) }) : null;
  if (arc) parts.push(arc);
  if (look === 'kitchen') parts.push(s('circle', { class: 'clock-rim', cx: C, cy: C, r: FACE + 5 }));
  parts.push(s('circle', { class: 'clock-face', cx: C, cy: C, r: FACE }));
  if (quarters) for (let q = 0; q < 4; q++) parts.push(s('path', { class: `clock-quarter q${q % 2}`, d: quarterPath(q * 15) }));
  for (let m = 0; m < 60; m++) {
    const five = m % 5 === 0;
    // A station clock has bars instead of numbers.
    const long = look === 'station' && five ? 12 : five ? 8 : 5;
    const a = point(m, FACE - 2);
    const b = point(m, FACE - long);
    parts.push(s('line', { class: five ? 'clock-tick five' : 'clock-tick', x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) }));
  }
  if (numbers && look !== 'station') {
    for (let n = 1; n <= 12; n++) {
      const p = point(n * 5, 34);
      parts.push(s('text', { class: 'clock-number', x: fmt(p.x), y: fmt(p.y + 4.5) }, String(n)));
    }
  }
  const ringLabels: SVGTextElement[] = [];
  if (minuteRing) {
    for (let n = 1; n <= 12; n++) {
      const p = point(n * 5, RING);
      const lit = minute !== undefined && n * 5 <= minute;
      const t = s('text', { class: `clock-minutes${lit ? ' lit' : ''}`, x: fmt(p.x), y: fmt(p.y + 3.5) }, String(n * 5));
      ringLabels.push(t);
      parts.push(t);
    }
  }
  if (hour !== undefined) parts.push(s('line', { class: 'clock-hand hour', x1: C, y1: C, x2: C, y2: C - 24, transform: handTransform(hourAngle(hour)) }));
  const hand = minute !== undefined ? s('line', { class: 'clock-hand minute', x1: C, y1: C, x2: C, y2: C - 40, transform: handTransform(minuteAngle(minute)) }) : null;
  if (hand) parts.push(hand);
  parts.push(s('circle', { class: 'clock-pin', cx: C, cy: C, r: 3.5 }));
  const svg = s('svg', { class: `clock-view look-${look}`, viewBox: '0 0 140 140', role: 'img', 'aria-label': label }, ...parts);

  if (hop && hand && minute !== undefined && minute > 0 && !prefersReducedMotion()) {
    // From 12, one number at a time, to where the hand stands.
    const steps = Math.ceil(minute / 5);
    const show = (m: number) => {
      hand.setAttribute('transform', handTransform(minuteAngle(m)));
      arc?.setAttribute('d', arcPath(m));
      ringLabels.forEach((t, i) => t.classList.toggle('lit', (i + 1) * 5 <= m));
    };
    show(0);
    for (let i = 1; i <= steps; i++) setTimeout(() => show(Math.min(i * 5, minute)), i * HOP_STEP_MS);
  }
  return svg;
}
