import { atLeast, type Item, type PresentContext, type Presentation } from '../../engine';
import { isDivisionId, parseDivisionId } from './division';

/**
 * Delat med in three forms, so that a division is tied to its multiplication
 * and the equal sign is not read as "the answer comes next":
 * - standard `21 ÷ 3 = __`
 * - missing factor `__ × 3 = 21` (the same square, the other way round)
 * - reversed `__ = 21 ÷ 3`
 * Every form is retrieval of the same fact and counts as evidence. A division
 * the child has just met is shown in the usual form the first few times; once
 * it sits, mostly the usual form, which is the one the status is about.
 * Multiplications and the "Dela lika" tasks have one form.
 */
const FORMS = {
  learning: [
    ['standard', 0.6],
    ['missing', 0.25],
    ['reversed', 0.15],
  ],
  fluent: [
    ['standard', 0.8],
    ['missing', 0.1],
    ['reversed', 0.1],
  ],
} as const;

/** Answers before the varied forms are mixed in. */
export const STANDARD_FIRST = 2;

export function presentMultiplication(item: Item, { state, kind, rng }: PresentContext): Presentation {
  if (!isDivisionId(item.id)) return { variant: 'standard', prompt: item.prompt };
  const { dividend, divisor } = parseDivisionId(item.id);
  const standard = { variant: 'standard', prompt: `${item.prompt} = __` };
  if (kind === 'new' || kind === 'rehearse' || kind === 'derive' || state.seen < STANDARD_FIRST) return standard;

  let r = rng.next();
  let form: string = 'standard';
  for (const [name, weight] of FORMS[atLeast(state.status, 'fluent') ? 'fluent' : 'learning']) {
    form = name;
    if ((r -= weight) < 0) break;
  }
  if (form === 'missing') return { variant: 'missing', prompt: `__ × ${divisor} = ${dividend}` };
  if (form === 'reversed') return { variant: 'reversed', prompt: `__ = ${item.prompt}` };
  return standard;
}
