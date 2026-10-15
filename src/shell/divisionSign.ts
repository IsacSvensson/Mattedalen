import { h } from './dom';

/**
 * How "delat med" is written for a child: a fraction bar by default (21 over 3),
 * as in many Swedish textbooks, or `÷` or `/` if a grown-up chooses so. Prompts
 * keep the canonical `21 ÷ 3`; this draws it with the child's sign.
 */
export type DivisionSign = 'fraction' | 'obelus' | 'slash';

export const DIVISION_SIGNS: { value: DivisionSign; label: string }[] = [
  { value: 'fraction', label: 'Bråkstreck' },
  { value: 'obelus', label: '÷' },
  { value: 'slash', label: '/' },
];

export const DEFAULT_DIVISION_SIGN: DivisionSign = 'fraction';

export type MathPart = string | { dividend: string; divisor: string };

/** A text split into plain parts and divisions: "21 ÷ 3 = __" → [{21, 3}, " = __"]. */
export function splitDivisions(text: string): MathPart[] {
  const out: MathPart[] = [];
  const re = /(\d+)\s*÷\s*(\d+)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ dividend: m[1]!, divisor: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The text with every division in the child's sign: a stacked fraction, or `÷` or `/`. */
export function mathNodes(text: string, sign: DivisionSign): (Node | string)[] {
  return splitDivisions(text).map((part) => {
    if (typeof part === 'string') return part;
    if (sign === 'obelus') return `${part.dividend} ÷ ${part.divisor}`;
    if (sign === 'slash') return `${part.dividend}/${part.divisor}`;
    return h('span', { class: 'frac' }, h('span', { class: 'frac-num' }, part.dividend), h('span', { class: 'frac-den' }, part.divisor));
  });
}
