import { describe, expect, it } from 'vitest';
import { emptyState, seededRng, sortedUnits, validatePack, type Item, type QuestionKind } from '../../src/engine';
import { createAdditionPack } from '../../src/content/addition';
import { createMultiplicationPack, derivationStepsFor } from '../../src/content/multiplication';
import {
  BROOK_PREREQUISITES,
  confusionNote,
  createHundredPack,
  crossesTen,
  derivationSteps,
  isFactId,
  parseTaskId,
  presentHundred,
  taskAnswer,
  taskId,
  UNIT_DEFS,
  unitOf,
} from '../../src/content/hundred';

const pack = createHundredPack();
const byId = new Map(pack.items.map((i) => [i.id, i]));
const facts = pack.items.filter((i) => isFactId(i.id));
const unitIndex = (unitId: string) => UNIT_DEFS.findIndex((u) => u.id === unitId);
const inUnit = (unitId: string) => pack.items.filter((i) => i.unitId === unitId);

/** Works out a number sentence with one blank (`__`), or a calculation without one. */
function solve(prompt: string): number {
  const value = (side: string): number | null => {
    const s = side.trim().replace(/−/g, '-');
    let m = /^hälften av (\d+)$/.exec(s);
    if (m) return Number(m[1]) / 2;
    m = /^dubbla (\d+)$/.exec(s);
    if (m) return 2 * Number(m[1]);
    m = /^(\d+) tiotal$/.exec(s);
    if (m) return 10 * Number(m[1]);
    m = /^(\d+) tiotal och (\d+) ental$/.exec(s);
    if (m) return 10 * Number(m[1]) + Number(m[2]);
    m = /^(\d+) ental och (\d+) tiotal$/.exec(s);
    if (m) return 10 * Number(m[2]) + Number(m[1]);
    if (!/^[\d +-]+$/.test(s)) return null;
    return s
      .split(/(?=[+-])/)
      .map((t) => Number(t.replace(/\s/g, '')))
      .reduce((a, b) => a + b, 0);
  };
  if (!prompt.includes('__')) return value(prompt)!;
  // Try every answer: the one that makes both sides equal.
  const hits = [];
  for (let n = 0; n <= 100; n++) {
    const [l, r] = prompt.replace('__', String(n)).split('=');
    const [a, b] = [value(l!), value(r!)];
    if (a !== null && b !== null && a === b) hits.push(n);
  }
  expect(hits, prompt).toHaveLength(1);
  return hits[0]!;
}

describe('the tasks of Stigen', () => {
  it('are a few hundred, all with whole answers from 0 to 100', () => {
    expect(() => validatePack(pack)).not.toThrow();
    expect(pack.items.length).toBeGreaterThanOrEqual(200);
    expect(pack.items.length).toBeLessThanOrEqual(260);
    for (const item of pack.items) {
      const answer = Number(item.answer);
      expect(Number.isInteger(answer), item.id).toBe(true);
      expect(answer).toBeGreaterThanOrEqual(0);
      expect(answer).toBeLessThanOrEqual(100);
      for (const n of item.prompt.match(/\d+/g) ?? []) expect(Number(n)).toBeLessThanOrEqual(100);
      expect(taskId(parseTaskId(item.id))).toBe(item.id);
    }
  });

  it('are worked out right in every form they are shown in', () => {
    const rng = seededRng(3);
    const kinds: QuestionKind[] = ['new', 'due', 'mixed', 'retry'];
    const minus = new Set<string>();
    for (const item of pack.items) {
      const variants = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const state = { ...emptyState(item.id), seen: 5 };
        const shown = presentHundred(item, { state, kind: kinds[i % kinds.length]!, format: 'free', rng });
        variants.add(shown.variant);
        expect(solve(shown.prompt), `${item.id}: ${shown.prompt}`).toBe(Number(item.answer));
      }
      if (/^\d+-\d+$/.test(item.id)) for (const v of variants) minus.add(v);
    }
    expect([...minus].sort()).toEqual(['missing', 'reversed', 'standard']);
  });

  it('show a new task in the usual form', () => {
    const item = byId.get('52-6')!;
    const shown = presentHundred(item, { state: emptyState(item.id), kind: 'new', format: 'free', rng: seededRng(1) });
    expect(shown.prompt).toBe('52 − 6 = __');
    expect(presentHundred(byId.get('next:37')!, { state: emptyState('next:37'), kind: 'new', format: 'free', rng: seededRng(1) }).prompt).toBe('37 + __ = 40');
    expect(presentHundred(byId.get('half:56')!, { state: emptyState('half:56'), kind: 'due', format: 'free', rng: seededRng(1) }).prompt).toBe('hälften av 56 = __');
  });

  it('are in the part their description says', () => {
    for (const item of facts) {
      const t = parseTaskId(item.id) as { kind: 'fact'; op: '+' | '-'; x: number; y: number };
      const ones = (n: number) => n % 10;
      switch (item.unitId) {
        case 'tiotal':
          expect(t.x % 10 + (t.y % 10)).toBe(0);
          break;
        case 'hopptio':
          expect(t.y % 10).toBe(0);
          break;
        case 'ental':
          expect(crossesTen(parseTaskId(item.id))).toBe(false);
          expect(t.y).toBeLessThan(10);
          break;
        case 'tilltio':
          expect([t.op, t.x % 10]).toEqual(['-', 0]);
          break;
        case 'overtio':
          expect(crossesTen(parseTaskId(item.id))).toBe(true);
          expect(t.y).toBeLessThan(10);
          break;
        case 'dubbla':
          expect(t.x).toBe(t.y);
          break;
        case 'tvasiffr':
          expect(t.x).toBeGreaterThan(10);
          expect(t.y).toBeGreaterThan(10);
          expect([ones(t.x), ones(t.y)]).not.toContain(0);
          break;
        default:
          throw new Error(`${item.id} in ${item.unitId}`);
      }
    }
    expect(['47+8', '52-6', '35+7', '60-6'].map((id) => byId.get(id)!.unitId)).toEqual(['overtio', 'overtio', 'overtio', 'tilltio']);
    expect(['34+10', '58-20', '26+30'].filter((id) => byId.has(id)).map((id) => byId.get(id)!.unitId)).toEqual(['hopptio', 'hopptio']);
    expect(unitOf(parseTaskId('34+25'))).toBe('tvasiffr');
    expect(inUnit('tiental').every((i) => i.id.startsWith('te:'))).toBe(true);
  });

  it('have a graph of parts that starts with whole tens, and say what each builds on at the brook', () => {
    const units = sortedUnits(pack.units);
    expect(units[0]!.id).toBe('tiotal');
    expect(units[0]!.unlockRule.kind).toBe('always');
    expect(units.find((u) => u.id === 'tiental')!.kind).toBe('understanding');
    expect(units.find((u) => u.id === 'overtio')!.unlockRule).toMatchObject({ kind: 'after', requires: ['ental', 'tilltio'] });
    expect(units.find((u) => u.id === 'dubbla')!.lane).toBe('dubbla');
    expect(units.find((u) => u.id === 'tvasiffr')!.unlockRule).toMatchObject({ kind: 'after', requires: ['hopptio', 'overtio'] });
    const brook = new Set(createAdditionPack().units.map((u) => u.id));
    for (const [unit, requires] of Object.entries(BROOK_PREREQUISITES)) {
      expect(unitIndex(unit)).toBeGreaterThanOrEqual(0);
      for (const r of requires!) expect(brook.has(r), r).toBe(true);
    }
    for (const unit of units) expect(unit.itemIds.length, unit.id).toBeGreaterThanOrEqual(10);
  });

  it('pair a double with its half, and the way up to a ten with the way down from it', () => {
    expect(byId.get('28+28')!.pairId).toBe('half:56');
    expect(byId.get('half:56')!.pairId).toBe('28+28');
    expect(byId.get('60-4')!.pairId).toBe('next:56');
    expect(byId.get('47+8')!.pairId).toBeUndefined();
  });
});

describe('räknestigar on Stigen', () => {
  const withPath = pack.items.filter((i) => i.derivedFrom.length > 0);

  it('lead from what the child knows, in steps that are each right, to the task', () => {
    expect(withPath.length).toBeGreaterThan(60);
    for (const item of withPath) {
      const steps = derivationSteps(item.id)!;
      expect(steps, item.id).not.toBeNull();
      for (const step of steps) expect(solve(step.prompt), `${item.id}: ${step.prompt}`).toBe(step.answer);
      expect(steps.at(-1)!.kind).toBe('target');
      expect(steps.at(-1)!.answer).toBe(Number(item.answer));
      for (const from of item.derivedFrom) {
        // What the path starts from comes in an earlier part, or earlier in the same part.
        const source = byId.get(from)!;
        const before = unitIndex(source.unitId) < unitIndex(item.unitId) || (source.unitId === item.unitId && source.order < item.order);
        expect(before, `${item.id} from ${from}`).toBe(true);
        expect(steps.some((s) => s.itemId === from)).toBe(true);
      }
    }
  });

  it('go via the ten, as on an empty number line', () => {
    const show = (id: string) => derivationSteps(id)!.map((s) => `${s.prompt} = ${s.answer}`);
    expect(show('47+8')).toEqual(['47 + 3 = 50', '50 + 5 = 55', '47 + 8 = 55']);
    expect(show('52-6')).toEqual(['52 − 2 = 50', '50 − 4 = 46', '52 − 6 = 46']);
    expect(show('47+36')).toEqual(['47 + 30 = 77', '77 + 6 = 83', '47 + 36 = 83']);
    expect(show('28+28')).toEqual(['20 + 20 = 40', '8 + 8 = 16', '40 + 16 = 56', '28 + 28 = 56']);
    expect(show('half:70')).toEqual(['hälften av 60 = 30', 'hälften av 10 = 5', '30 + 5 = 35', 'hälften av 70 = 35']);
    expect(derivationSteps('34+5')).toBeNull();
    expect(byId.get('47+8')!.hints.find((h) => h.kind === 'numberline')!.data).toEqual({ stops: [47, 50, 55], up: true });
    expect(byId.get('26+30')?.hints.find((h) => h.kind === 'numberline')!.data).toEqual({ stops: [26, 36, 46, 56], up: true });
  });

  it('have a way to think that ends in the answer', () => {
    for (const item of pack.items) {
      const text = item.hints.find((h) => h.kind === 'strategy')!.text!;
      expect(text, item.id).toMatch(new RegExp(`${item.answer}\\b`));
    }
  });
});

describe('wrong answers on Stigen', () => {
  const values = (id: string) => pack.distractorCandidates(byId.get(id)!).map((c) => c.value);

  it('are at least five plausible numbers from 0 to 100, never the answer', () => {
    for (const item of pack.items) {
      const vs = values(item.id);
      expect(new Set(vs).size, item.id).toBe(vs.length);
      expect(vs.length).toBeGreaterThanOrEqual(5);
      for (const v of vs) {
        expect(v).not.toBe(item.answer);
        expect(Number(v)).toBeGreaterThanOrEqual(0);
        expect(Number(v)).toBeLessThanOrEqual(100);
      }
    }
  });

  it('include the typical mistakes, with a kind word about them', () => {
    const typical: [string, string, RegExp][] = [
      ['52-6', '54', /inte ta 6 från 2/],
      ['47+8', '45', /nya tiotalet/],
      ['26+30', '29', /3 tiotal/],
      ['34+5', '84', /ental/],
      ['half:56', '23', /40 och 16/],
      ['te:47:t', '7', /entalen/],
      ['te:3t14e', '34', /tiotal/],
      ['next:37', '7', /finns redan/],
    ];
    for (const [id, wrong, note] of typical) {
      expect(values(id), id).toContain(wrong);
      expect(confusionNote(id, wrong), id).toMatch(note);
    }
    expect(confusionNote('te:47', '74')).toMatch(/Tiotalen står först/);
    expect(confusionNote('47+8', '56')).toMatch(/nära/);
    expect(confusionNote('47+8', '55')).toBeUndefined();
  });
});

describe('Stigen and the garden', () => {
  /**
   * A step of a räknestig in the garden as one calculation at a time: 30 + 6 + 6
   * is 30 + 6 and 36 + 6. Within 20 it is the brook's (12 + 4 in 8 + 4 + 4).
   */
  function calculations(prompt: string): string[] {
    const half = /^hälften av (\d+)$/.exec(prompt);
    if (half) {
      const n = Number(half[1]);
      return n <= 20 ? [] : [`half:${n}`];
    }
    const terms = prompt.replace(/−/g, '-').split(' ');
    const out: string[] = [];
    let acc = Number(terms[0]);
    for (let i = 1; i < terms.length; i += 2) {
      const [op, y] = [terms[i]!, Number(terms[i + 1])];
      // 25 + 5 reaches the ten: on Stigen that is 25 + __ = 30.
      const result = op === '+' ? acc + y : acc - y;
      if (Math.max(acc, result) > 20) out.push(op === '+' && result % 10 === 0 && acc % 10 !== 0 ? `next:${acc}` : `${acc}${op}${y}`);
      acc = result;
    }
    return out;
  }

  it('covers every step the garden’s räknestigar take, or the brook does', () => {
    const garden = createMultiplicationPack({ division: true });
    const missing = new Set<string>();
    let checked = 0;
    for (const item of garden.items) {
      for (const step of derivationStepsFor(item.id) ?? []) {
        if (step.kind !== 'combine') continue;
        for (const id of calculations(step.prompt)) {
          checked++;
          if (!byId.has(id)) missing.add(`${id} (${step.prompt})`);
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect([...missing]).toEqual([]);
  });

  it('teaches each step in the part the garden waits for', () => {
    // ×5 and ×4 wait for doubling and halving; ×3, ×6 and ×9 for over the ten; squares, ×7 and ×8 for two-digit sums.
    const unit = (id: string) => byId.get(id)!.unitId;
    expect(['half:70', '14+14', '28+28', '32+32'].map(unit)).toEqual(['dubbla', 'dubbla', 'dubbla', 'dubbla']);
    expect(['35+7', '18+9', '14+7'].map(unit)).toEqual(['overtio', 'overtio', 'overtio']);
    expect(['60-6', '90-9'].map(unit)).toEqual(['tilltio', 'tilltio']);
    expect(unit('35+14')).toBe('tvasiffr');
  });

  it('keeps the answer to every task a number the brook’s number pad can type', () => {
    for (const item of pack.items as Item[]) expect(item.answer).toMatch(/^\d{1,3}$/);
    expect(taskAnswer(parseTaskId('next:95'))).toBe(5);
  });
});
