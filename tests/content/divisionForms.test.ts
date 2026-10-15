import { describe, expect, it } from 'vitest';
import { emptyState, seededRng, type ItemState, type QuestionKind } from '../../src/engine';
import {
  createMultiplicationPack,
  derivationStepsFor,
  divisionDerivationSteps,
  factId,
  isDivisionId,
  parseDivisionId,
  STANDARD_FIRST,
} from '../../src/content/multiplication';
import { splitDivisions } from '../../src/shell/divisionSign';
import { spokenText } from '../../src/shell/speech';
import { decodeTransfer, DEFAULT_SETTINGS, encodeTransfer, EXPORT_FORMAT, parseExport } from '../../src/storage';
import { transferOf } from '../../src/shell/transfer';

const pack = createMultiplicationPack({ division: true });
const divisions = pack.items.filter((it) => isDivisionId(it.id));
const item = (id: string) => pack.items.find((it) => it.id === id)!;

function shown(id: string, state: Partial<ItemState>, kind: QuestionKind = 'due', seed = 1) {
  return pack.present!(item(id), { state: { ...emptyState(id), ...state }, kind, format: 'free', rng: seededRng(seed) });
}

/** Value of a step: "5 × 6", "30 + 6 + 6", "60 − 6", "hälften av 14" or "42 ÷ 6". */
function evaluate(prompt: string): number {
  const half = /^hälften av (\d+)$/.exec(prompt);
  if (half) return Number(half[1]) / 2;
  const times = /^(\d+) × (\d+)$/.exec(prompt);
  if (times) return Number(times[1]) * Number(times[2]);
  const div = /^(\d+) ÷ (\d+)$/.exec(prompt);
  if (div) return Number(div[1]) / Number(div[2]);
  const terms = prompt.split(' ');
  let value = Number(terms[0]);
  for (let i = 1; i < terms.length; i += 2) value += (terms[i] === '+' ? 1 : -1) * Number(terms[i + 1]);
  return value;
}

describe('the forms of a division', () => {
  it('shows the usual form while the division is new', () => {
    for (const kind of ['new', 'rehearse', 'derive'] as const) expect(shown('21/3', { seen: 9, status: 'learning' }, kind).prompt).toBe('21 ÷ 3 = __');
    expect(shown('21/3', { seen: STANDARD_FIRST - 1, status: 'learning' }).variant).toBe('standard');
  });

  it('then mixes in the missing factor and the reversed form', () => {
    const count = (status: ItemState['status']) => {
      const n: Record<string, number> = {};
      for (let seed = 1; seed <= 2000; seed++) {
        const p = shown('21/3', { seen: 5, status }, 'due', seed);
        n[p.variant] = (n[p.variant] ?? 0) + 1;
        const expected = { standard: '21 ÷ 3 = __', missing: '__ × 3 = 21', reversed: '__ = 21 ÷ 3' }[p.variant];
        expect(p.prompt).toBe(expected);
        expect(p.evidence).toBeUndefined();
      }
      return n;
    };
    const learning = count('learning');
    expect(learning.standard! / 2000).toBeCloseTo(0.6, 1);
    expect(learning.missing! / 2000).toBeCloseTo(0.25, 1);
    expect(learning.reversed! / 2000).toBeCloseTo(0.15, 1);
    // Once it sits, mostly the usual form.
    expect(count('fluent').standard! / 2000).toBeCloseTo(0.8, 1);
  });

  it('keeps the missing factor in the division’s own square', () => {
    // 21 ÷ 3 = 7 lives in square 7 × 3: the blank is the 7.
    const p = Array.from({ length: 200 }, (_, s) => shown('21/3', { seen: 5, status: 'learning' }, 'due', s + 1)).find((x) => x.variant === 'missing')!;
    expect(p.prompt).toBe('__ × 3 = 21');
    expect(item(factId(7, 3)).answer).toBe('21');
  });

  it('leaves multiplications and "Dela lika" as they are', () => {
    expect(shown('3x7', { seen: 9, status: 'fluent' })).toEqual({ variant: 'standard', prompt: '3 × 7' });
    const share = pack.items.find((it) => it.unitId === 'delalika')!;
    expect(shown(share.id, { seen: 9 }).prompt).toBe(share.prompt);
    expect(createMultiplicationPack().present).toBeUndefined();
  });
});

describe('räknestigen for a division', () => {
  it('adds up, starts from known facts, and ends in the division', () => {
    let paths = 0;
    for (const it of divisions) {
      const steps = divisionDerivationSteps(it.id);
      if (!steps) continue;
      paths++;
      const { dividend, divisor, quotient } = parseDivisionId(it.id);
      for (const step of steps) expect(evaluate(step.prompt), `${it.id}: ${step.prompt}`).toBe(step.answer);
      expect(steps.at(-1)).toMatchObject({ kind: 'target', prompt: `${dividend} ÷ ${divisor}`, answer: quotient });
      // The path starts from what the item is derived from, so it is offered only when those sit.
      const known = steps.flatMap((s) => (s.itemId ? [s.itemId] : []));
      expect(it.derivedFrom).toEqual(expect.arrayContaining(known));
      // No earlier step is the division's own multiplication, which would give the answer away.
      for (const step of steps.slice(0, -1)) {
        expect(step.prompt).not.toBe(`${quotient} × ${divisor}`);
        expect(step.prompt).not.toBe(`${divisor} × ${quotient}`);
      }
    }
    expect(paths).toBeGreaterThan(50);
  });

  it('counts groups from five or ten, halves, or goes via ten', () => {
    expect(divisionDerivationSteps('42/6')!.map((s) => s.prompt)).toEqual(['5 × 6', '30 + 6 + 6', '42 ÷ 6']);
    expect(divisionDerivationSteps('54/6')!.map((s) => s.prompt)).toEqual(['10 × 6', '60 − 6', '54 ÷ 6']);
    expect(divisionDerivationSteps('14/2')!.map((s) => s.prompt)).toEqual(['hälften av 14', '14 ÷ 2']);
    expect(divisionDerivationSteps('40/5')!.map((s) => s.prompt)).toEqual(['40 ÷ 10', '4 + 4', '40 ÷ 5']);
    // Nothing to derive from without giving it away.
    for (const id of ['30/10', '7/1', '7/7', '12/6', '30/6']) expect(divisionDerivationSteps(id)).toBeNull();
  });

  it('serves both kinds of fact', () => {
    expect(derivationStepsFor('6x7')!.at(-1)!.prompt).toBe('6 × 7');
    expect(derivationStepsFor('42/6')!.at(-1)!.prompt).toBe('42 ÷ 6');
    expect(derivationStepsFor('share:share:6:2')).toBeNull();
  });
});

describe('how delat med is written', () => {
  it('finds the divisions in a text', () => {
    expect(splitDivisions('21 ÷ 3 = __')).toEqual([{ dividend: '21', divisor: '3' }, ' = __']);
    expect(splitDivisions('__ = 21 ÷ 3')).toEqual(['__ = ', { dividend: '21', divisor: '3' }]);
    expect(splitDivisions('40 ÷ 10, och 4 + 4')).toEqual([{ dividend: '40', divisor: '10' }, ', och 4 + 4']);
    expect(splitDivisions('3 × 7')).toEqual(['3 × 7']);
  });

  it('is read aloud as "delat med"', () => {
    expect(spokenText('21 ÷ 3 = __')).toBe('21 delat med 3 är hur mycket');
  });

  it('follows the child in backups and QR codes', () => {
    const backup = (settings: Record<string, unknown>) =>
      parseExport({
        format: EXPORT_FORMAT,
        version: 1,
        exportedAt: 1,
        profile: { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { ...DEFAULT_SETTINGS, ...settings } },
        progress: [],
        sessions: [],
        attempts: [],
      }).profile.settings.divisionSign;
    expect(backup({ divisionSign: 'slash' })).toBe('slash');
    expect(backup({ divisionSign: 'obelus' })).toBe('obelus');
    expect(backup({})).toBeUndefined();
    expect(backup({ divisionSign: 'bogus' })).toBeUndefined();

    const profile = { id: 'p', name: 'Alva', avatar: '🦊', createdAt: 1, settings: { ...DEFAULT_SETTINGS } };
    const states = Object.fromEntries(pack.items.map((it) => [it.id, emptyState(it.id)]));
    for (const sign of ['obelus', 'slash'] as const) {
      const t = decodeTransfer(encodeTransfer(transferOf({ ...profile, settings: { ...profile.settings, divisionSign: sign, gardenOpen: true } }, [{ pack, states }])));
      expect(t).toMatchObject({ divisionSign: sign, gardenOpen: true });
    }
    expect(decodeTransfer(encodeTransfer(transferOf(profile, [{ pack, states }]))).divisionSign).toBeUndefined();
  });
});
