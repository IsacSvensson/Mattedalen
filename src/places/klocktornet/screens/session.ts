import type { Question, SessionMode } from '../../../engine';
import { clockNote, handsNote, parseClock, parseTaskId, phrase, supportsFor, unitOfTime, type ClockShow, type Time } from '../../../content/clock';
import type { Profile } from '../../../storage';
import type { AppContext } from '../../../shell/app';
import { clockFace, handTransform, hourAngle, minuteAngle, type ClockFaceOptions } from '../../../shell/components/clockFace';
import { clockSetter } from '../../../shell/components/clockSetter';
import { icon } from '../../../shell/components/icons';
import { h, prefersReducedMotion } from '../../../shell/dom';
import { runSession, type SessionPlace } from '../../../shell/screens/session';
import { towerDeps } from '../pack';
import { showTowerEnd } from './sessionEnd';
import { showTower } from './tower';

/** A session in Klocktornet (docs/PLAN-KLOCKAN.md, KL3): climbing the tower is reading the clock. */
export function showTowerSession(ctx: AppContext, profile: Profile, mode: SessionMode): Promise<void> {
  return runSession(ctx, profile, towerSession(ctx, profile), mode);
}

/** How long the hands take to go round to a time (the minute hand from 12 to 6: half of it). */
const TURN_MS = 1600;

const minutesOf = (t: Time) => (t.h % 12) * 60 + t.m;
const showOf = (q: Question) => q.item.hints.find((x) => x.kind === 'clock')?.data as ClockShow | undefined;
const strategyOf = (q: Question) => q.item.hints.find((x) => x.kind === 'strategy')?.text;

/** The face for a question: the time, with the supports for how well the question sits. */
function faceFor(q: Question, show: ClockShow, extra: Partial<ClockFaceOptions> = {}): SVGSVGElement {
  const supports = supportsFor(q.state, q.item.unitId, q.variant);
  const { time, hourOnly } = show;
  return clockFace({
    ...(hourOnly ? {} : { minute: time.m }),
    hour: time.h + time.m / 60,
    minuteRing: !hourOnly && supports.minuteRing,
    quarters: supports.quarters,
    look: supports.look,
    label: 'En klocka',
    ...extra,
  });
}

/**
 * A face whose hands go round together from `from` to `to` (minutes after
 * 12:00): the minute hand turns and the hour hand moves on with it, as on a
 * clock with gears. With reduced motion it stands at `to` at once.
 */
export function movingClock(from: number, to: number, opts: Omit<ClockFaceOptions, 'minute' | 'hour'>, onDone?: () => void): SVGSVGElement {
  const at = (total: number) => ({ minute: ((total % 60) + 60) % 60, hour: total / 60 });
  const svg = clockFace({ ...opts, ...at(prefersReducedMotion() ? to : from) });
  const minuteHand = svg.querySelector('.clock-hand.minute');
  const hourHand = svg.querySelector('.clock-hand.hour');
  if (prefersReducedMotion() || from === to || !minuteHand || !hourHand) {
    if (onDone) setTimeout(onDone, 0);
    return svg;
  }
  const start = performance.now();
  const span = Math.max(400, (Math.abs(to - from) / 60) * TURN_MS * 2);
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / span);
    const total = from + (to - from) * (1 - (1 - k) * (1 - k));
    minuteHand.setAttribute('transform', handTransform(minuteAngle(total % 60)));
    hourHand.setAttribute('transform', handTransform(hourAngle(total / 60)));
    if (k < 1) requestAnimationFrame(step);
    else onDone?.();
  };
  requestAnimationFrame(step);
  return svg;
}

function towerSession(ctx: AppContext, profile: Profile): SessionPlace {
  return {
    deps: towerDeps(ctx),
    homeLabel: 'Tillbaka till tornet',
    leave: () => showTower(ctx, profile),
    end: (summary) => showTowerEnd(ctx, profile, summary),

    /**
     * Something new: a time is shown as a movement, the minute hand from 12
     * to the time and the hour hand along with it; a question in words is
     * shown with its answer and why.
     */
    intro(q, ready) {
      const task = parseTaskId(q.item.id);
      const why = strategyOf(q);
      const time = task.kind === 'read' || task.kind === 'minutes' ? task.t : null;
      if (time) {
        const words = phrase(time);
        return {
          label: [icon('watch'), 'Ett nytt klockslag'],
          spoken: `Ett nytt klockslag. ${why ?? ''}`,
          body: h('div', { class: 'tower-intro' }, movingClock(0, minutesOf(time), { minuteRing: true, quarters: unitOfTime(time) === 'kvart', label: `En klocka som visar ${words ?? `${time.h}:${String(time.m).padStart(2, '0')}`}` }, ready)),
          after: [why ? h('p', { class: 'strategy' }, why) : null],
        };
      }
      setTimeout(ready, 0);
      const show = showOf(q);
      return {
        label: [icon('watch'), 'Något nytt i tornet'],
        spoken: `${q.item.prompt} ${q.item.answer}. ${why ?? ''}`,
        body: h('div', { class: 'tower-intro' }, show ? faceFor(q, show) : null, h('p', { class: 'intro-answer' }, `${q.item.prompt} ${q.item.answer}`)),
        after: [why ? h('p', { class: 'strategy' }, why) : null],
      };
    },

    /** The clock is the question itself: it is always there, with fewer supports as the question sits. */
    askVisual(q) {
      const show = showOf(q);
      return show ? faceFor(q, show) : null;
    },

    /** A time to set: the hands on the face, going together, and "Svara". */
    input(q, submit) {
      const task = parseTaskId(q.item.id);
      if (task.kind !== 'read' || task.form !== 'stall') return null;
      const unit = unitOfTime(task.t);
      const step = unit === 'femmin' ? 5 : unit === 'kvart' ? 15 : 30;
      const supports = supportsFor(q.state, q.item.unitId, q.variant);
      const setter = clockSetter({ start: minutesOf(task.t) === 0 ? 6 * 60 : 0, step, face: { minuteRing: supports.minuteRing, quarters: supports.quarters } });
      let sent = false;
      const send = () => {
        if (sent) return;
        sent = true;
        ok.disabled = true;
        submit(setter.value().text);
      };
      const ok = h('button', { class: 'big-button set-answer', type: 'button', onclick: send }, icon('check', 'on-primary'), 'Svara') as HTMLButtonElement;
      return {
        el: h('div', { class: 'answer-area set-clock' }, setter.el, ok),
        onKey: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            send();
          } else setter.onKey(e);
        },
      };
    },

    // Understanding has no derivation path.
    derivation: () => null,

    /** Which hand is wrong, why, and the right movement on the face. */
    help(q, fb) {
      const task = parseTaskId(q.item.id);
      const show = showOf(q);
      const time = task.kind === 'read' || task.kind === 'minutes' ? task.t : null;
      const note = time && task.kind === 'read' && task.form === 'stall' ? handsNote(time, fb.given) : clockNote(task, fb.given);
      if (!time) return { note, strategy: strategyOf(q), ...(show ? { visual: faceFor(q, show) } : {}) };
      // From the child's time, when the answer was one, to the right one.
      const given = parseClock(fb.given);
      const from = given ? minutesOf(given) : 0;
      return {
        note,
        strategy: strategyOf(q),
        visual: movingClock(from, minutesOf(time), { minuteRing: true, quarters: unitOfTime(time) === 'kvart', label: 'En klocka som visar rätt tid' }),
      };
    },
  };
}
