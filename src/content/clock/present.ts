import { atLeast, type Item, type ItemState, type PresentContext, type Presentation } from '../../engine';
import { parseTaskId } from './tasks';
import { CLOCK_LOOKS, formatClock, phrase, type ClockLook } from './time';

/**
 * How a clock question is shown (docs/PLAN-KLOCKAN.md): new questions with the
 * plain face; once a question sits, the face varies (a kitchen clock, a watch,
 * a station clock), so the child learns to read any clock. A time to set is
 * asked in words or as digital time.
 */
export function presentClock(item: Item, { state, kind, rng }: PresentContext): Presentation {
  const task = parseTaskId(item.id);
  const settled = kind !== 'new' && kind !== 'rehearse' && atLeast(state.status, 'fluent');
  const look = settled ? CLOCK_LOOKS[Math.floor(rng.next() * CLOCK_LOOKS.length)]! : 'plain';
  if (task.kind === 'read' && task.form === 'stall') {
    const words = phrase(task.t);
    const asWords = words !== null && (!settled || rng.next() < 0.5);
    return { variant: asWords ? 'ord' : 'dig', prompt: `Ställ klockan på ${asWords ? words : formatClock(task.t)}.` };
  }
  return { variant: look, prompt: item.prompt };
}

/** What the face beside a question has, as the question settles (docs/PLAN-KLOCKAN.md, KL3). */
export interface FaceSupports {
  minuteRing: boolean;
  quarters: boolean;
  look: ClockLook;
}

/**
 * The supports are taken away one at a time: a new question has the minutes
 * round the edge (and the quarters, for quarters); one being learnt only the
 * numbers; one that sits the look of the day (`variant`), a station clock
 * even without numbers.
 */
export function supportsFor(state: Pick<ItemState, 'status' | 'box'> | undefined, unitId: string, variant?: string): FaceSupports {
  const fresh = !state || state.status === 'new' || (state.status === 'learning' && state.box === 0);
  if (fresh) return { minuteRing: true, quarters: unitId === 'kvart', look: 'plain' };
  if (!atLeast(state.status, 'fluent')) return { minuteRing: false, quarters: false, look: 'plain' };
  const look = (CLOCK_LOOKS as readonly string[]).includes(variant ?? '') ? (variant as ClockLook) : 'plain';
  return { minuteRing: false, quarters: false, look };
}
