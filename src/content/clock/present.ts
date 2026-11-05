import { atLeast, type Item, type PresentContext, type Presentation } from '../../engine';
import { parseTaskId } from './tasks';
import { CLOCK_LOOKS, formatClock, phrase } from './time';

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
