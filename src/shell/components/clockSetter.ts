import { clockFace, handTransform, hourAngle, minuteAngle, type ClockFaceOptions } from './clockFace';

/**
 * Hands the child sets (docs/PLAN-KLOCKAN.md, KL1). By default the hands go
 * together, as on a clock with gears: the child drags anywhere on the face,
 * the minute hand follows the finger, snaps to `step` minutes, and the hour
 * hand moves on with it; past 12 it is the next hour (or, backwards, the one
 * before). Unlinked (a challenge later), the child takes the hand nearest the
 * finger, and the hour hand stands wherever the child puts it: then it shows
 * whether the child matches the numbers (4:30 with the hour hand on 4).
 */
export interface ClockSetterOptions {
  /** The time to start at, in minutes after 12:00 (0–719). */
  start?: number;
  /** Minutes per snap of the minute hand: 30, 15, 5 or 1. */
  step?: number;
  /** The hands go together (default). */
  linked?: boolean;
  /** Supports on the face, as on `clockFace`. */
  face?: Pick<ClockFaceOptions, 'minuteRing' | 'quarters' | 'numbers' | 'look'>;
  onChange?(time: SetTime): void;
}

export interface SetTime {
  /** The time the hands show, read from the minute hand and the hour it is in: "3:30". */
  text: string;
  /** Where the minute hand stands, 0–59. */
  minute: number;
  /** Where the hour hand stands, in hours from 12 (0–12, eighths of an hour unlinked). */
  hourAt: number;
}

export interface ClockSetter {
  el: SVGSVGElement;
  value(): SetTime;
  /** Arrow keys move the minute hand a step; with Shift the hour hand, when the hands are unlinked. */
  onKey(e: KeyboardEvent): void;
}

/** The angle from the centre to (x, y), in degrees clockwise from 12 (0–360). */
export function angleAt(x: number, y: number, cx: number, cy: number): number {
  const deg = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** The minute nearest an angle, snapped to `step` minutes (0–59). */
export function snapMinute(angle: number, step: number): number {
  const m = Math.round((angle / 6) / step) * step;
  return m % 60;
}

/** The hour hand's place nearest an angle, in eighths of an hour (0 to just under 12). */
export function snapHour(angle: number): number {
  return (Math.round((angle / 30) * 8) / 8) % 12;
}

/**
 * A drag with the hands together: where the finger is (`raw`, minutes 0–60
 * round the face, not snapped) decides when 12 is passed, so a coarse step
 * (30 minutes: only 12 and 6) still goes on to the next hour.
 */
export interface Drag {
  /** The hour the finger is in, 0–11. */
  hour: number;
  /** Where the finger was, in minutes round the face. */
  raw: number;
}

/** The drag after the finger moves to `raw`, and the time it shows (minutes after 12:00, 0–719). */
export function dragTo(drag: Drag, raw: number, step: number): { drag: Drag; total: number } {
  let hour = drag.hour;
  if (raw - drag.raw < -30) hour += 1;
  else if (raw - drag.raw > 30) hour -= 1;
  hour = ((hour % 12) + 12) % 12;
  // Snapped to the step; 60 is the next hour's 0.
  const m = Math.round(raw / step) * step;
  return { drag: { hour, raw }, total: (hour * 60 + m) % 720 };
}

/** "3:30" for 210 minutes after 12:00; the hour 0 is 12. With `h24`, the hour as given and two digits: "15:30". */
export function formatTime(total: number, h24 = false): string {
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  if (h24) return `${String(h).padStart(2, '0')}:${m}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

export function clockSetter(opts: ClockSetterOptions = {}): ClockSetter {
  const { step = 5, linked = true, face = {}, onChange } = opts;
  let total = ((opts.start ?? 0) % 720 + 720) % 720;
  // Unlinked: the hour hand's own place, in hours.
  let hourAt = total / 60;
  let minute = total % 60;

  const el = clockFace({ ...face, minute, hour: hourAt, label: '' });
  el.classList.add('clock-setter', linked ? 'linked' : 'unlinked');
  el.setAttribute('role', 'slider');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', linked ? 'Ställ klockan' : 'Ställ visarna');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '719');
  const minuteHand = el.querySelector<SVGLineElement>('.clock-hand.minute')!;
  const hourHand = el.querySelector<SVGLineElement>('.clock-hand.hour')!;

  const value = (): SetTime => ({ text: formatTime(linked ? total : Math.floor(hourAt) * 60 + minute), minute, hourAt });
  const draw = () => {
    minuteHand.setAttribute('transform', handTransform(minuteAngle(minute)));
    hourHand.setAttribute('transform', handTransform(hourAngle(hourAt)));
    const v = value();
    el.setAttribute('aria-valuenow', String(linked ? total : Math.round(hourAt * 60)));
    el.setAttribute('aria-valuetext', `Klockan ${v.text}`);
    el.dataset.time = v.text;
    el.dataset.hourAt = String(hourAt);
    onChange?.(v);
  };
  const setTotal = (t: number) => {
    total = ((t % 720) + 720) % 720;
    minute = total % 60;
    hourAt = total / 60;
    draw();
  };
  // Where the finger is in a drag with the hands together.
  let drag: Drag = { hour: Math.floor(total / 60), raw: total % 60 };

  // Which hand a drag holds: always the minute hand when they go together.
  let holding: 'minute' | 'hour' | null = null;
  const angleOf = (e: PointerEvent) => {
    const box = el.getBoundingClientRect();
    return angleAt(e.clientX, e.clientY, box.left + box.width / 2, box.top + box.height / 2);
  };
  const move = (e: PointerEvent) => {
    const a = angleOf(e);
    if (holding === 'hour') {
      hourAt = snapHour(a);
      draw();
    } else if (linked) {
      const next = dragTo(drag, a / 6, step);
      drag = next.drag;
      setTotal(next.total);
    } else {
      minute = snapMinute(a, step);
      draw();
    }
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const a = angleOf(e);
    if (linked) {
      holding = 'minute';
      // The finger lands: from where the minute hand is, the shortest way round.
      drag = { hour: Math.floor(total / 60), raw: total % 60 };
    }
    else {
      const off = (deg: number) => Math.min(Math.abs(a - deg), 360 - Math.abs(a - deg));
      holding = off(hourAngle(hourAt)) < off(minuteAngle(minute)) ? 'hour' : 'minute';
    }
    el.setPointerCapture?.(e.pointerId);
    move(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (holding) move(e);
  });
  const release = () => (holding = null);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    if (e.shiftKey && !linked) {
      hourAt = (((hourAt + dir / 8) % 12) + 12) % 12;
      draw();
    } else if (linked) setTotal(total + dir * step);
    else {
      minute = (((minute + dir * step) % 60) + 60) % 60;
      draw();
    }
  };

  draw();
  return { el, value, onKey };
}
