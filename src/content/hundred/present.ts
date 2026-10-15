import type { Item, PresentContext, Presentation } from '../../engine';
import { formatFact, parseTaskId, tenAbove } from './tasks';

/**
 * The same task in varied forms, as at the brook, so the equal sign keeps
 * meaning "is as much as": `47 + 8 = __`, `__ = 47 + 8`, and for a
 * subtraction the missing part (`6 + __ = 52` for 52 − 6). A double can be
 * asked as "dubbla 14", and the way up to the ten as a difference
 * (`40 − 37 = __` for 37 + __ = 40). A task the child has just met is shown in
 * the usual form the first few times. Every form counts as evidence.
 */
const FORMS: Record<string, readonly (readonly [string, number])[]> = {
  plus: [
    ['standard', 0.7],
    ['reversed', 0.3],
  ],
  minus: [
    ['standard', 0.6],
    ['reversed', 0.25],
    ['missing', 0.15],
  ],
  double: [
    ['standard', 0.6],
    ['double', 0.25],
    ['reversed', 0.15],
  ],
  next: [
    ['standard', 0.7],
    ['difference', 0.3],
  ],
};

/** Answers before the varied forms are mixed in. */
const STANDARD_FIRST = 2;

export function presentHundred(item: Item, { state, kind, rng }: PresentContext): Presentation {
  const t = parseTaskId(item.id);
  if (t.kind === 'half') return { variant: 'standard', prompt: `${item.prompt} = __` };
  if (t.kind !== 'fact' && t.kind !== 'next') return { variant: 'standard', prompt: item.prompt };

  const standard = { variant: 'standard', prompt: t.kind === 'fact' ? `${item.prompt} = __` : item.prompt };
  if (kind === 'new' || kind === 'rehearse' || kind === 'derive' || state.seen < STANDARD_FIRST) return standard;

  const forms = t.kind === 'next' ? FORMS.next! : t.op === '-' ? FORMS.minus! : t.x === t.y ? FORMS.double! : FORMS.plus!;
  let r = rng.next();
  let form = 'standard';
  for (const [name, weight] of forms) {
    form = name;
    if ((r -= weight) < 0) break;
  }
  if (t.kind === 'next') return form === 'difference' ? { variant: 'difference', prompt: `${formatFact('-', tenAbove(t.n), t.n)} = __` } : standard;
  if (form === 'reversed') return { variant: 'reversed', prompt: `__ = ${item.prompt}` };
  if (form === 'missing') return { variant: 'missing', prompt: `${t.y} + __ = ${t.x}` };
  if (form === 'double') return { variant: 'double', prompt: `dubbla ${t.x} = __` };
  return standard;
}
