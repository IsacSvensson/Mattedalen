import { describe, expect, it } from 'vitest';
import { validatePack } from '../../src/engine';
import {
  confusionNote,
  createMultiplicationPack,
  derivationSteps,
  factId,
  multiplicationDistractors,
  normalizeNumberAnswer,
  parseFactId,
  strategyFor,
} from '../../src/content/multiplication';

const pack = createMultiplicationPack();
const byId = new Map(pack.items.map((i) => [i.id, i]));
const unitOrder = new Map(pack.units.map((u) => [u.id, u.order]));

describe('multiplication facts', () => {
  it('covers the 10×10 grid with correct answers', () => {
    expect(pack.items).toHaveLength(100);
    for (const item of pack.items) {
      const { a, b } = parseFactId(item.id);
      expect(item.answer).toBe(String(a * b));
      expect(item.prompt).toBe(`${a} × ${b}`);
    }
    expect(() => validatePack(pack)).not.toThrow();
  });

  it('links mirrored facts (3×7 ↔ 7×3), squares have no twin', () => {
    expect(byId.get('3x7')!.pairId).toBe('7x3');
    expect(byId.get('7x3')!.pairId).toBe('3x7');
    expect(byId.get('6x6')!.pairId).toBeUndefined();
    expect(pack.items.filter((i) => i.pairId === undefined)).toHaveLength(10);
  });

  it('keeps mirrored facts in the same unit', () => {
    for (const item of pack.items) if (item.pairId) expect(byId.get(item.pairId)!.unitId).toBe(item.unitId);
  });
});

describe('unit progression', () => {
  it('follows ×10, ×2, ×5, ×1 → ×4, ×3, squares → ×9, ×6 → ×7/×8', () => {
    expect(pack.units.map((u) => u.title)).toEqual(['×10', '×2', '×5', '×1', '×4', '×3', 'Kvadrattal', '×9', '×6', '×7 och ×8']);
    expect(pack.units.map((u) => u.itemIds.length)).toEqual([19, 17, 15, 13, 11, 9, 4, 6, 4, 2]);
  });

  it('places each fact with the first table it belongs to', () => {
    expect(byId.get('3x10')!.unitId).toBe('u10');
    expect(byId.get('7x2')!.unitId).toBe('u2');
    expect(byId.get('3x7')!.unitId).toBe('u3');
    expect(byId.get('7x7')!.unitId).toBe('usq');
    expect(byId.get('7x9')!.unitId).toBe('u9');
    expect(byId.get('6x8')!.unitId).toBe('u6');
    expect(byId.get('8x7')!.unitId).toBe('u78');
  });

  it('can be limited to the first units', () => {
    const small = createMultiplicationPack({ maxUnits: 6 });
    expect(small.units.map((u) => u.title)).toEqual(['×10', '×2', '×5', '×1', '×4', '×3']);
    expect(small.items).toHaveLength(84);
    expect(() => validatePack(small)).not.toThrow();
  });

  it('only the first unit is open from the start; later ones need ~80 % fluent', () => {
    expect(pack.units[0]!.unlockRule).toEqual({ kind: 'always' });
    for (const u of pack.units.slice(1)) expect(u.unlockRule).toEqual({ kind: 'previous', fraction: 0.8, minStatus: 'fluent' });
  });

  it('derives facts only from facts in earlier units', () => {
    for (const item of pack.items) {
      for (const src of item.derivedFrom) {
        expect(unitOrder.get(byId.get(src)!.unitId)!, `${item.id} ← ${src}`).toBeLessThan(unitOrder.get(item.unitId)!);
      }
    }
  });
});

describe('strategies', () => {
  it.each([
    ['8x7', '8 × 7 = dubbla 4 × 7 = 28 + 28 = 56'],
    ['7x8', '7 × 8 = dubbla 7 × 4 = 28 + 28 = 56'],
    ['9x6', '9 × 6 = 10 × 6 − 6 = 60 − 6 = 54'],
    ['6x9', '6 × 9 = 6 × 10 − 6 = 60 − 6 = 54'],
    ['6x7', '6 × 7 = 5 × 7 + 7 = 35 + 7 = 42'],
    ['3x7', '3 × 7 = 2 × 7 + 7 = 14 + 7 = 21'],
    ['4x7', '4 × 7 = dubbla 2 × 7 = 14 + 14 = 28'],
    ['5x7', '5 × 7 = hälften av 10 × 7 = hälften av 70 = 35'],
    ['2x7', '2 × 7 = 7 + 7 = 14'],
    ['10x7', '10 × 7 = 7 tiotal = 70'],
    ['7x7', '7 × 7 = 5 × 7 + 2 × 7 = 35 + 14 = 49'],
    ['10x10', '10 × 10 = 10 tiotal = 100'],
    ['1x1', '1 × 1: en grupp med 1 = 1'],
  ])('%s → %s', (id, text) => {
    const { a, b } = parseFactId(id);
    expect(strategyFor(a, b).text).toBe(text);
  });

  it('every strategy ends in the right answer and its arithmetic is correct', () => {
    for (const item of pack.items) {
      const hint = item.hints.find((h) => h.kind === 'strategy')!;
      expect(hint.text!.endsWith(`= ${item.answer}`)).toBe(true);
      // Check each "x + y", "x − y" and "dubbla" step numerically.
      for (const m of hint.text!.matchAll(/(?<!× )\b(\d+) ([+−]) (\d+) = (\d+)/g)) {
        const [, x, op, y, z] = m;
        expect(op === '+' ? Number(x) + Number(y) : Number(x) - Number(y)).toBe(Number(z));
      }
    }
  });

  it('every derivation source is the fact the text refers to', () => {
    expect(byId.get('8x7')!.derivedFrom).toEqual([factId(4, 7)]);
    expect(byId.get('7x8')!.derivedFrom).toEqual([factId(7, 4)]);
    expect(byId.get('9x6')!.derivedFrom).toEqual([factId(10, 6)]);
  });

  it('includes an array picture and a turn-around hint', () => {
    const hints = byId.get('3x7')!.hints;
    expect(hints.find((h) => h.kind === 'array')!.data).toEqual({ rows: 3, cols: 7 });
    expect(hints.find((h) => h.kind === 'swap')!.text).toBe('3 × 7 är lika mycket som 7 × 3');
  });
});

describe('array parts', () => {
  const parts = (id: string) => {
    const { a, b } = parseFactId(id);
    return strategyFor(a, b).parts;
  };

  it('split the side of the table factor', () => {
    expect(parts('8x7')).toEqual({ axis: 'rows', sizes: [4, 4] });
    expect(parts('7x8')).toEqual({ axis: 'cols', sizes: [4, 4] });
    expect(parts('3x7')).toEqual({ axis: 'rows', sizes: [2, 1] });
    expect(parts('6x7')).toEqual({ axis: 'rows', sizes: [5, 1] });
    expect(parts('7x7')).toEqual({ axis: 'rows', sizes: [5, 2] });
    expect(parts('9x6')).toEqual({ axis: 'rows', sizes: [9, 1], removeLast: true });
    expect(parts('5x7')).toEqual({ axis: 'rows', sizes: [5, 5], removeLast: true });
    expect(parts('10x7')).toBeUndefined();
  });

  it('always add up to the fact (taking away the removed part)', () => {
    for (const item of pack.items) {
      const { a, b } = parseFactId(item.id);
      const p = strategyFor(a, b).parts;
      if (!p) continue;
      const kept = p.removeLast ? p.sizes.slice(0, -1) : p.sizes;
      const side = kept.reduce((x, y) => x + y, 0);
      expect(p.axis === 'rows' ? side : a, item.id).toBe(a);
      expect(p.axis === 'cols' ? side : b, item.id).toBe(b);
    }
  });
});

describe('confusion notes', () => {
  it('names the neighbouring fact behind a typical mistake', () => {
    expect(confusionNote(7, 8, '48')).toBe('48 är 6 × 8 – nära!');
    expect(confusionNote(7, 8, '63')).toBe('63 är 7 × 9 – nära!');
    expect(confusionNote(3, 4, '7')).toBe('7 är 3 + 4. Här ska det vara 3 gånger 4.');
    expect(confusionNote(7, 8, '57')).toBeUndefined();
    expect(confusionNote(7, 8, '56')).toBeUndefined();
  });
});

describe('distractors', () => {
  it('offers enough plausible, valid wrong answers for every fact', () => {
    for (const item of pack.items) {
      const values = new Set(pack.distractorCandidates(item).map((c) => c.value));
      expect(values.size, item.id).toBeGreaterThanOrEqual(5);
      expect(values.has(item.answer)).toBe(false);
      for (const v of values) expect(Number(v)).toBeGreaterThan(0);
    }
  });

  it('includes neighbouring facts and the add-instead-of-multiply slip', () => {
    const values = multiplicationDistractors(7, 8).map((c) => c.value);
    expect(values).toEqual(expect.arrayContaining(['48', '64', '49', '63', '15']));
  });

  it('weights neighbouring products highest', () => {
    const cands = multiplicationDistractors(6, 8);
    const weight = (v: string) => cands.filter((c) => c.value === v).reduce((s, c) => s + c.weight, 0);
    expect(weight('56')).toBeGreaterThan(weight('49'));
    expect(weight('42')).toBeGreaterThan(weight('49'));
  });
});

describe('answers', () => {
  it('normalises typed numbers', () => {
    expect(normalizeNumberAnswer(' 07 ')).toBe('7');
    expect(normalizeNumberAnswer('5 6')).toBe('56');
    expect(normalizeNumberAnswer('abc')).toBe('abc');
  });
});

describe('focus sets', () => {
  it('has one set per table with every fact of that table, in both orders', () => {
    const pack = createMultiplicationPack();
    const sets = pack.focusSets!;
    expect(sets.map((s) => s.title)).toEqual(['×1', '×2', '×3', '×4', '×5', '×6', '×7', '×8', '×9', '×10']);
    for (const set of sets) expect(set.itemIds).toHaveLength(19);
    const seven = sets.find((s) => s.id === 't7')!;
    expect(seven.itemIds).toEqual(expect.arrayContaining(['7x1', '1x7', '7x7', '7x8', '8x7', '10x7']));
    // A table cuts across units (×7 includes facts from ×1, ×2, ×5 …).
    expect(new Set(seven.itemIds.map((id) => pack.items.find((i) => i.id === id)!.unitId)).size).toBeGreaterThan(5);
  });

  it('only includes released facts', () => {
    const pack = createMultiplicationPack({ maxUnits: 2 });
    const ids = new Set(pack.items.map((i) => i.id));
    for (const set of pack.focusSets!) for (const id of set.itemIds) expect(ids.has(id)).toBe(true);
  });
});

describe('derivation paths (räknestigen)', () => {
  const evaluate = (prompt: string): number => {
    const half = /^hälften av (\d+)$/.exec(prompt);
    if (half) return Number(half[1]) / 2;
    const m = /^(\d+) ([+−×]) (\d+)$/.exec(prompt);
    if (!m) throw new Error(prompt);
    const [x, op, y] = [Number(m[1]), m[2], Number(m[3])];
    return op === '+' ? x + y : op === '−' ? x - y : x * y;
  };

  it('every derived fact has steps that add up, from facts it is derived from', () => {
    const pack = createMultiplicationPack();
    let withSteps = 0;
    for (const item of pack.items) {
      const { a, b } = parseFactId(item.id);
      const steps = derivationSteps(a, b);
      if (item.derivedFrom.length === 0) {
        expect(steps).toBeNull();
        continue;
      }
      withSteps++;
      expect(steps).not.toBeNull();
      const known = steps!.filter((st) => st.kind === 'known');
      expect(known.map((st) => st.itemId)).toEqual(item.derivedFrom);
      for (const st of steps!) expect(evaluate(st.prompt)).toBe(st.answer);
      expect(steps!.at(-1)).toMatchObject({ kind: 'target', answer: a * b });
      expect(steps!.at(-2)).toMatchObject({ kind: 'combine', answer: a * b });
    }
    expect(withSteps).toBeGreaterThan(50);
  });

  it('reads like the strategy: 6 × 7 via 5 × 7, 8 × 7 by doubling, 9 × 6 from 10 × 6', () => {
    expect(derivationSteps(6, 7)!.map((s) => s.prompt)).toEqual(['5 × 7', '35 + 7', '6 × 7']);
    expect(derivationSteps(8, 7)!.map((s) => s.prompt)).toEqual(['4 × 7', '28 + 28', '8 × 7']);
    expect(derivationSteps(9, 6)!.map((s) => s.prompt)).toEqual(['10 × 6', '60 − 6', '9 × 6']);
    expect(derivationSteps(7, 7)!.map((s) => s.prompt)).toEqual(['5 × 7', '2 × 7', '35 + 14', '7 × 7']);
  });
});
