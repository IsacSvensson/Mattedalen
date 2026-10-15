import type { DistractorCandidate, Item, ItemId } from '../../engine';

/**
 * "Lika stora grupper": what multiplying means, before the first table (see
 * docs/PLAN-HUNDRA.md). Four kinds, as children meet them in school:
 * - groups: 3 baskets with 4 strawberries in each – how many strawberries?
 * - repeated addition: 4 + 4 + 4 = __ × 4
 * - skip counting on the number line: 5, 10, 15, __
 * - zero and one: empty baskets, and baskets with one in each
 * Judged on right answers on different days, never on time (as "Dela lika").
 */
export type GroupTask =
  | { kind: 'groups'; groups: number; each: number }
  | { kind: 'repeat'; groups: number; each: number; ask: 'groups' | 'each' }
  | { kind: 'skip'; step: number; shown: number };

export const GROUP_TASKS: GroupTask[] = [
  { kind: 'groups', groups: 2, each: 3 },
  { kind: 'groups', groups: 3, each: 2 },
  { kind: 'groups', groups: 4, each: 2 },
  { kind: 'groups', groups: 2, each: 5 },
  { kind: 'groups', groups: 3, each: 4 },
  { kind: 'groups', groups: 5, each: 2 },
  { kind: 'repeat', groups: 3, each: 4, ask: 'groups' },
  { kind: 'repeat', groups: 2, each: 5, ask: 'groups' },
  { kind: 'repeat', groups: 4, each: 2, ask: 'groups' },
  { kind: 'repeat', groups: 3, each: 4, ask: 'each' },
  { kind: 'skip', step: 2, shown: 3 },
  { kind: 'skip', step: 5, shown: 3 },
  { kind: 'skip', step: 3, shown: 3 },
  { kind: 'skip', step: 10, shown: 3 },
  // Zero and one: empty baskets, and one in each.
  { kind: 'groups', groups: 3, each: 0 },
  { kind: 'groups', groups: 4, each: 1 },
];

export const groupId = (t: GroupTask): ItemId =>
  t.kind === 'skip' ? `lika:skip:${t.step}` : t.kind === 'repeat' ? `lika:repeat:${t.groups}x${t.each}:${t.ask}` : `lika:groups:${t.groups}x${t.each}`;

export const isGroupId = (id: ItemId) => id.startsWith('lika:');

const repeated = (groups: number, each: number) => Array<number>(groups).fill(each).join(' + ');
const skipNumbers = (t: { step: number; shown: number }) => Array.from({ length: t.shown }, (_, i) => (i + 1) * t.step);

export function groupAnswer(t: GroupTask): number {
  if (t.kind === 'skip') return (t.shown + 1) * t.step;
  if (t.kind === 'repeat') return t.ask === 'groups' ? t.groups : t.each;
  return t.groups * t.each;
}

export function groupText(t: GroupTask): string {
  if (t.kind === 'skip') return `Hoppa ${t.step} i taget: ${skipNumbers(t).join(', ')}, __`;
  if (t.kind === 'repeat') {
    return t.ask === 'groups'
      ? `${repeated(t.groups, t.each)} = __ × ${t.each}`
      : `${t.groups} × ${t.each} = ${repeated(t.groups - 1, t.each)} + __`;
  }
  if (t.each === 0) return `${t.groups} korgar utan några jordgubbar. Hur många jordgubbar?`;
  const berries = t.each === 1 ? 'jordgubbe' : 'jordgubbar';
  return `${t.groups} korgar med ${t.each} ${berries} i varje. Hur många jordgubbar?`;
}

function groupStrategy(t: GroupTask): string {
  const answer = groupAnswer(t);
  if (t.kind === 'skip') return `Varje hopp är ${t.step} till: ${[...skipNumbers(t), answer].join(', ')}.`;
  if (t.kind === 'repeat') return `${t.groups} grupper med ${t.each} i varje: ${repeated(t.groups, t.each)} är ${t.groups} × ${t.each}.`;
  if (t.each === 0) return `Tomma korgar: ${repeated(t.groups, 0)} = 0.`;
  return `${t.groups} grupper med ${t.each} i varje: ${repeated(t.groups, t.each)} = ${answer}. Det är ${t.groups} × ${t.each}.`;
}

/** The tasks as items of the understanding unit `lika`. */
export function buildGroupItems(): Item[] {
  return GROUP_TASKS.map((t, order) => ({
    id: groupId(t),
    prompt: groupText(t),
    answer: String(groupAnswer(t)),
    unitId: 'lika',
    tags: [`lika:${t.kind}`],
    derivedFrom: [],
    hints: [
      t.kind === 'skip' ? { kind: 'skip', data: { step: t.step, stops: [0, ...skipNumbers(t), groupAnswer(t)] } } : { kind: 'groups', data: { groups: t.groups, each: t.each } },
      { kind: 'strategy', text: groupStrategy(t) },
    ],
    formats: ['choice'],
    order,
  }));
}

/** Wrong answers children typically give: one off, adding instead of multiplying, the size of a group. */
export function groupDistractors(t: GroupTask): DistractorCandidate[] {
  const right = groupAnswer(t);
  const out: DistractorCandidate[] = [];
  const add = (value: number, weight: number) => {
    if (value >= 0 && value !== right && !out.some((c) => c.value === String(value))) out.push({ value: String(value), weight });
  };
  if (t.kind === 'groups') {
    add(t.groups + t.each, 3);
    add(t.each, 2);
    add(t.groups, 1);
  }
  if (t.kind === 'repeat') add(t.ask === 'groups' ? t.each : t.groups, 3);
  if (t.kind === 'skip') add(right - 1, 2);
  add(right + 1, 2);
  add(right - 1, 1);
  add(right + 2, 1);
  add(right * 2, 0.5);
  return out;
}
