import type { Item, PresentContext, Presentation } from '../../engine';
import { isEqualityId } from './equality';
import { parseFactId } from './facts';

/**
 * The equal sign in varied forms from the first week (McNeil et al.): the same
 * fact is asked as `7 + 5 = __`, `__ = 7 + 5` and, for a subtraction,
 * `7 + __ = 12` (12 − 7: the missing part, which ties subtraction to addition).
 * A fact the child has just met is shown in the usual form the first few times.
 * Every form is retrieval of the same fact and counts as evidence.
 */
const FORMS = {
  '+': [
    ['standard', 0.7],
    ['reversed', 0.3],
  ],
  '-': [
    ['standard', 0.6],
    ['reversed', 0.25],
    ['missing', 0.15],
  ],
} as const;

/** Answers before the varied forms are mixed in. */
const STANDARD_FIRST = 2;

export function presentFact(item: Item, { state, kind, rng }: PresentContext): Presentation {
  if (isEqualityId(item.id)) return { variant: item.tags.includes('equality:truefalse') ? 'truefalse' : 'balance', prompt: item.prompt };
  const f = parseFactId(item.id);
  const standard = { variant: 'standard', prompt: `${item.prompt} = __` };
  if (kind === 'new' || kind === 'rehearse' || kind === 'derive' || state.seen < STANDARD_FIRST) return standard;

  let r = rng.next();
  let form: string = 'standard';
  for (const [name, weight] of FORMS[f.op]) {
    form = name;
    if ((r -= weight) < 0) break;
  }
  if (form === 'reversed') return { variant: 'reversed', prompt: `__ = ${item.prompt}` };
  if (form === 'missing') return { variant: 'missing', prompt: `${f.y} + __ = ${f.x}` };
  return standard;
}
