import { h } from '../dom';

/** The digits of a digital clock: "07:30", the hour and the minutes in two digits each. */
export const digitalText = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * A digital clock (docs/PLAN-KLOCKAN.md, KL1), as on a real one: the hour, a
 * colon and the minutes, in a dark box. `hour` is 0–23 on a 24-hour clock.
 */
export function digitalClock({ hour, minute }: { hour: number; minute: number }): HTMLElement {
  const text = digitalText(hour, minute);
  return h('span', { class: 'digital-clock', role: 'img', 'aria-label': `Klockan ${text}` }, text);
}
