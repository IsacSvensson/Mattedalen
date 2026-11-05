import { describe, expect, it } from 'vitest';
import { angleAt, dragTo, type Drag, formatTime, snapHour, snapMinute } from '../../src/shell/components/clockSetter';
import { digitalText } from '../../src/shell/components/digitalClock';

/** Hands to set on a clock (docs/PLAN-KLOCKAN.md, KL1). */
describe('the angle from the centre', () => {
  it('is 0 at 12 and goes clockwise', () => {
    expect(angleAt(0, -10, 0, 0)).toBeCloseTo(0);
    expect(angleAt(10, 0, 0, 0)).toBeCloseTo(90);
    expect(angleAt(0, 10, 0, 0)).toBeCloseTo(180);
    expect(angleAt(-10, 0, 0, 0)).toBeCloseTo(270);
  });
});

describe('snapping the minute hand', () => {
  it('goes to the nearest step, and a whole turn is 0', () => {
    expect(snapMinute(180, 30)).toBe(30);
    expect(snapMinute(100, 30)).toBe(30);
    expect(snapMinute(80, 30)).toBe(0);
    expect(snapMinute(350, 30)).toBe(0);
    expect(snapMinute(95, 15)).toBe(15);
    expect(snapMinute(150, 5)).toBe(25);
    expect(snapMinute(153, 1)).toBe(26);
    expect(snapMinute(359, 1)).toBe(0);
    for (const step of [30, 15, 5, 1]) for (let a = 0; a < 360; a += 7) expect(snapMinute(a, step) % step).toBe(0);
  });
  it('snaps the hour hand in eighths of an hour', () => {
    expect(snapHour(120)).toBe(4);
    expect(snapHour(135)).toBe(4.5);
    expect(snapHour(359)).toBe(0);
  });
});

describe('the hour follows the finger past 12', () => {
  /** Drags round from 3:00 through these places (minutes round the face), returning the time at each. */
  const dragRound = (raws: number[], step: number) => {
    let drag: Drag = { hour: 3, raw: 0 };
    return raws.map((raw) => {
      const next = dragTo(drag, raw, step);
      drag = next.drag;
      return next.total;
    });
  };
  const turn = (from: number, to: number, by: number) => Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => (from + i * by) % 60);

  it('forwards to the next hour, backwards to the one before, at every step', () => {
    for (const step of [30, 15, 5, 1]) {
      // One whole turn forwards from 3:00 is 4:00, two are 5:00.
      expect(dragRound(turn(0, 60, 2), step).at(-1)).toBe(4 * 60);
      expect(dragRound(turn(0, 120, 2), step).at(-1)).toBe(5 * 60);
      // One turn backwards is 2:00.
      expect(dragRound(turn(0, 60, 2).map((m) => (60 - m) % 60), step).at(-1)).toBe(2 * 60);
    }
  });

  it('with steps of 30 minutes: 3:00, 3:30, 4:00, 4:30', () => {
    const times = dragRound(turn(0, 120, 2), 30);
    expect([...new Set(times)]).toEqual([180, 210, 240, 270, 300]);
  });

  it('round the clock: 11:55 to 12:00, and back', () => {
    expect(dragTo({ hour: 11, raw: 55 }, 0.5, 5).total).toBe(0);
    expect(dragTo({ hour: 0, raw: 1 }, 55, 5).total).toBe(11 * 60 + 55);
  });
});

describe('the time as text', () => {
  it('is 12-hour by default, with 12 for 0', () => {
    expect(formatTime(210)).toBe('3:30');
    expect(formatTime(0)).toBe('12:00');
    expect(formatTime(45)).toBe('12:45');
    expect(formatTime(11 * 60 + 5)).toBe('11:05');
  });
  it('is two digits on a 24-hour clock and a digital clock', () => {
    expect(formatTime(15 * 60 + 30, true)).toBe('15:30');
    expect(formatTime(7 * 60 + 5, true)).toBe('07:05');
    expect(digitalText(7, 30)).toBe('07:30');
  });
});
