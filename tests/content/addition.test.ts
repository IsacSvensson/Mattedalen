import { describe, expect, it } from 'vitest';
import {
  applyPlacement,
  createEngine,
  emptyState,
  ManualClock,
  Placement,
  seededRng,
  sortedUnits,
  validatePack,
  type Item,
  type ItemState,
} from '../../src/engine';
import {
  additionDistractors,
  buildFacts,
  confusionNote,
  createAdditionPack,
  derivationSteps,
  EQUALITIES,
  equalityDistractors,
  familyOf,
  isEqualityId,
  isFactId,
  landings,
  normalizeAnswer,
  parseFactId,
  presentFact,
  unitOf,
  UNIT_DEFS,
} from '../../src/content/addition';

const pack = createAdditionPack();
const facts = pack.items.filter((i) => isFactId(i.id));
const byId = new Map(pack.items.map((i) => [i.id, i]));
const unitIndex = (unitId: string) => UNIT_DEFS.findIndex((u) => u.id === unitId);

describe('the facts of Bäcken', () => {
  it('are every addition and subtraction with terms 0–10, and the equal sign tasks', () => {
    expect(facts).toHaveLength(242);
    expect(pack.items).toHaveLength(242 + EQUALITIES.length);
    expect(() => validatePack(pack)).not.toThrow();
    for (const item of facts) {
      const f = parseFactId(item.id);
      expect(Number(item.answer)).toBe(f.answer);
      expect(f.answer).toBeGreaterThanOrEqual(0);
      const { a, b } = familyOf(f);
      expect(a).toBeLessThanOrEqual(10);
      expect(b).toBeLessThanOrEqual(10);
      expect(item.prompt).toMatch(/^\d+ [+−] \d+$/);
    }
  });

  it('keeps each family together in one unit', () => {
    const families = new Map<string, Set<string>>();
    for (const item of facts) {
      const tag = item.tags.find((t) => t.startsWith('family:'))!;
      families.set(tag, (families.get(tag) ?? new Set()).add(item.unitId));
    }
    for (const units of families.values()) expect(units.size).toBe(1);
    expect(unitOf(5, 8)).toBe('overtio');
    expect(['8+5', '5+8', '13-5', '13-8'].map((id) => byId.get(id)!.unitId)).toEqual(['overtio', 'overtio', 'overtio', 'overtio']);
    expect(['7+3', '10-7'].map((id) => byId.get(id)!.unitId)).toEqual(['tiokamrater', 'tiokamrater']);
  });

  it('pairs each fact with its twin the other way round', () => {
    expect(byId.get('8+5')!.pairId).toBe('5+8');
    expect(byId.get('13-5')!.pairId).toBe('13-8');
    expect(byId.get('6+6')!.pairId).toBeUndefined();
  });

  it('has a graph of units that starts with what children already know', () => {
    const units = sortedUnits(pack.units);
    expect(units.slice(0, 2).map((u) => u.unlockRule.kind)).toEqual(['always', 'always']);
    expect(units.find((u) => u.id === 'overtio')!.unlockRule).toMatchObject({ kind: 'after', requires: ['tiokamrater', 'tio'] });
    const vagen = units.find((u) => u.id === 'vagen')!;
    expect(vagen.kind).toBe('understanding');
    expect(vagen.itemIds.every(isEqualityId)).toBe(true);
  });
});

describe('derivation paths ("räknestigar")', () => {
  it('add up, end in the fact itself and never show its answer before the last step', () => {
    let paths = 0;
    for (const item of facts) {
      const steps = derivationSteps(item.id);
      if (!steps) continue;
      paths++;
      const f = parseFactId(item.id);
      const target = steps[steps.length - 1]!;
      expect(target.kind).toBe('target');
      expect(target.prompt).toBe(item.prompt);
      expect(target.answer).toBe(f.answer);
      for (const step of steps) {
        const m = /^(\d+) ([+−]) (\d+)$/.exec(step.prompt)!;
        expect(m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3])).toBe(step.answer);
        expect(step.label).not.toContain(String(f.answer));
      }
    }
    expect(paths).toBeGreaterThan(50);
  });

  it('build on facts of earlier units, which the engine requires to be known first', () => {
    for (const item of facts) {
      for (const from of item.derivedFrom) {
        const source = byId.get(from);
        expect(source, `${item.id} ← ${from}`).toBeDefined();
        expect(unitIndex(source!.unitId)).toBeLessThan(unitIndex(item.unitId));
      }
    }
  });

  it('go over ten, down to ten, or count up when the numbers are close', () => {
    const show = (id: string) => derivationSteps(id)!.map((s) => `${s.prompt} = ${s.answer}`);
    expect(show('8+5')).toEqual(['8 + 2 = 10', '10 + 3 = 13', '8 + 5 = 13']);
    expect(show('9+6')).toEqual(['10 + 6 = 16', '16 − 1 = 15', '9 + 6 = 15']);
    expect(show('6+7')).toEqual(['6 + 6 = 12', '12 + 1 = 13', '6 + 7 = 13']);
    expect(show('13-5')).toEqual(['13 − 3 = 10', '10 − 2 = 8', '13 − 5 = 8']);
    expect(show('12-9')).toEqual(['9 + 1 = 10', '10 + 2 = 12', '1 + 2 = 3', '12 − 9 = 3']);
    expect(derivationSteps('3+4')).not.toBeNull();
    expect(derivationSteps('2+3')).toBeNull();
  });
});

describe('the number line', () => {
  it('lands on the stops worth saying aloud, not on every stone', () => {
    const at = (id: string) => landings(parseFactId(id));
    expect(at('8+5')).toEqual({ stops: [8, 10, 13], up: true });
    expect(at('3+8')).toEqual({ stops: [8, 10, 11], up: true });
    expect(at('4+3')).toEqual({ stops: [4, 7], up: true });
    expect(at('13-5')).toEqual({ stops: [13, 10, 8], up: false });
    expect(at('12-9')).toEqual({ stops: [9, 10, 12], up: true });
  });
});

describe('wrong answers from known misconceptions', () => {
  const values = (id: string) => additionDistractors(parseFactId(id)).map((c) => c.value);

  it('are plausible, never the answer and never negative', () => {
    for (const item of facts) {
      const vals = values(item.id);
      expect(new Set(vals).size).toBeGreaterThanOrEqual(3);
      expect(vals).not.toContain(item.answer);
      for (const v of vals) expect(Number(v)).toBeGreaterThanOrEqual(0);
    }
  });

  it('include counting slips, the other operation and the classic mistakes over ten', () => {
    expect(values('8+5')).toEqual(expect.arrayContaining(['12', '14', '3', '31']));
    // 13 − 5: "5 − 3 = 2" in the ones gives 12; 13 + 5 is the other operation.
    expect(values('13-5')).toEqual(expect.arrayContaining(['12', '18', '7', '9']));
    expect(confusionNote('13-5', '12')).toMatch(/ner till 10/);
    expect(confusionNote('9+4', '3')).toMatch(/tiotalet/);
    expect(confusionNote('9+4', '5')).toMatch(/plus/);
    expect(confusionNote('8+5', '7')).toBeUndefined();
    expect(confusionNote('9-4', '13')).toMatch(/minus/);
  });

  it('for the equal sign: the left side worked out (12) and everything added (20)', () => {
    const e = EQUALITIES.find((x) => x.kind === 'balance' && x.left.join() === '7,5')!;
    expect(e.answer).toBe(4);
    expect(equalityDistractors(e).map((c) => c.value)).toEqual(expect.arrayContaining(['12', '20']));
    expect(confusionNote('eq:7+5=_+8', '12')).toMatch(/andra sidan/);
    expect(confusionNote('eq:7+5=_+8', '20')).toMatch(/allt ihop/);
  });
});

describe('the equal sign tasks (Vågen)', () => {
  it('have the right answers', () => {
    const value = (xs: (number | null)[], blank: number) => xs.reduce<number>((s, x) => s + (x ?? blank), 0);
    for (const e of EQUALITIES) {
      if (e.kind === 'balance') expect(value(e.left, e.answer)).toBe(value(e.right, e.answer));
      else expect(e.answer).toBe(value(e.left, 0) === value(e.right, 0) ? 'ja' : 'nej');
    }
    expect(EQUALITIES.filter((e) => e.kind === 'truefalse').some((e) => e.answer === 'nej')).toBe(true);
  });

  it('ask "stämmer det?" with two options only, and judge understanding without a clock', () => {
    const clock = new ManualClock(Date.UTC(2026, 1, 2, 15));
    const engine = createEngine({ pack, clock, rng: seededRng(4) });
    const tf = pack.items.find((i) => i.tags.includes('equality:truefalse'))!;
    let states: Record<string, ItemState> = {
      ...engine.initialStates(),
      [tf.id]: { ...emptyState(tf.id), status: 'learning', box: 1, dueDay: '2026-02-02', introducedDay: '2026-01-20', seen: 4, correct: 4 },
    };
    // Slow but right on two later days.
    for (let day = 0; day < 2; day++) {
      clock.set(Date.UTC(2026, 1, 2 + day, 15));
      const session = engine.startSession({ states, meta: engine.initialMeta(), mode: 'focus', focusItemIds: [tf.id] });
      for (let q = session.next(); q; q = session.next()) {
        if (q.item.id === tf.id) {
          expect(q.format).toBe('choice');
          expect(q.choices).toHaveLength(2);
          expect(q.choices).toEqual(expect.arrayContaining(['ja', 'nej']));
        }
        clock.advance(20_000);
        session.submit(q.item.answer, 15_000);
      }
      states = session.stateRecord();
    }
    expect(states[tf.id]!.status).toBe('fluent');
  });
});

describe('the equal sign in varied forms', () => {
  const rng = seededRng(7);
  const known = (item: Item): ItemState => ({ ...emptyState(item.id), status: 'fluent', seen: 6, correct: 6 });

  it('starts with the usual form, then mixes in reversed and missing-part forms', () => {
    const sub = byId.get('13-5')!;
    expect(presentFact(sub, { state: emptyState(sub.id), kind: 'new', format: 'choice', rng })).toEqual({ variant: 'standard', prompt: '13 − 5 = __' });
    expect(presentFact(sub, { state: { ...emptyState(sub.id), seen: 1 }, kind: 'mixed', format: 'choice', rng }).variant).toBe('standard');
    const forms = new Map<string, string>();
    for (let i = 0; i < 200; i++) {
      const p = presentFact(sub, { state: known(sub), kind: 'mixed', format: 'free', rng });
      forms.set(p.variant, p.prompt);
    }
    expect(Object.fromEntries(forms)).toEqual({ standard: '13 − 5 = __', reversed: '__ = 13 − 5', missing: '5 + __ = 13' });
    const add = byId.get('8+5')!;
    const addForms = new Set(Array.from({ length: 100 }, () => presentFact(add, { state: known(add), kind: 'due', format: 'free', rng }).variant));
    expect([...addForms].sort()).toEqual(['reversed', 'standard']);
  });

  it('are asked in a session and stored with the answer', () => {
    const clock = new ManualClock(Date.UTC(2026, 1, 2, 15));
    const engine = createEngine({ pack, clock, rng: seededRng(3) });
    const states = Object.fromEntries(facts.map((i) => [i.id, { ...known(i), dueDay: '2026-02-09', box: 2, introducedDay: '2026-01-01' }]));
    const session = engine.startSession({ states: { ...engine.initialStates(), ...states }, meta: { ...engine.initialMeta(), unlockedUnitIds: UNIT_DEFS.map((u) => u.id) } });
    const variants = new Set<string>();
    for (let q = session.next(); q; q = session.next()) {
      clock.advance(4000);
      const fb = session.submit(q.item.answer, 2000);
      expect(fb.correct).toBe(true);
      variants.add(fb.attempt.variant!);
    }
    expect([...variants]).toEqual(expect.arrayContaining(['standard', 'reversed', 'missing']));
  });
});

describe('answers and the start check', () => {
  it('reads numbers as numbers and yes/no in any case', () => {
    expect(normalizeAnswer(' 08 ')).toBe('8');
    expect(normalizeAnswer('Ja')).toBe('ja');
  });

  it('lets a child who knows the easy parts skip them, and tests other branches after a miss', () => {
    const placement = new Placement(pack, seededRng(2));
    const knows = new Set(['noll', 'ettmer', 'sma', 'tio', 'dubblor']);
    let asked = 0;
    for (let item = placement.next(); item; item = placement.next()) {
      asked++;
      placement.submit(knows.has(item.unitId) ? item.answer : '0', 2500);
    }
    const result = placement.result();
    expect(result.passedUnitIds.sort()).toEqual([...knows].sort());
    // A miss on the pairs that make ten skips what builds on them, but doubles are still tested.
    expect(result.failedUnitIds).toContain('tiokamrater');
    expect(result.stoppedAt).toBe('tiokamrater');
    expect(asked).toBeLessThanOrEqual(30);
    const engine = createEngine({ pack });
    const placed = applyPlacement(pack, engine.config, result, engine.initialStates(), engine.initialMeta(), '2026-02-02');
    expect(placed.meta.unlockedUnitIds).toEqual(expect.arrayContaining(['noll', 'ettmer', 'sma', 'tio', 'tiokamrater', 'dubblor', 'naradubblor']));
    expect(placed.meta.unlockedUnitIds).not.toContain('overtio');
    // The equal sign is not part of the check.
    expect(result.answers.some((a) => isEqualityId(a.itemId))).toBe(false);
  });

  it('builds the same facts every time', () => {
    expect(buildFacts().map((i) => i.id)).toEqual(buildFacts().map((i) => i.id));
  });
});

describe('new facts at the brook', () => {
  it('come part by part, in the order of the parts, though the facts are ordered by their sum', () => {
    const clock = new ManualClock(Date.UTC(2026, 1, 2, 12));
    const engine = createEngine({ pack, clock, rng: seededRng(4) });
    const states = engine.initialStates();
    const known = (id: string): ItemState => ({ ...emptyState(id), status: 'fluent', box: 3, dueDay: '2026-03-01' });
    for (const unit of pack.units) {
      if (['ettmer', 'noll', 'sma', 'tio', 'tiokamrater'].includes(unit.id)) for (const id of unit.itemIds) states[id] = known(id);
    }
    // Doubles nearly done: 8 + 8 and 9 + 9 are left, while Inom 10 is open too.
    const doubles = pack.units.find((u) => u.id === 'dubblor')!.itemIds;
    doubles.slice(0, -4).forEach((id) => (states[id] = known(id)));
    const session = engine.startSession({ states, meta: engine.initialMeta() });
    const introduced: string[] = [];
    for (let q = session.next(); q; q = session.next()) {
      if (q.kind === 'new') introduced.push(q.item.id);
      clock.advance(5000);
      session.submit(q.item.answer, 1500);
    }
    const unitOrder = (id: string) => pack.units.find((u) => u.itemIds.includes(id))!.order;
    expect(introduced.length).toBeGreaterThan(1);
    expect(doubles).toContain(introduced[0]);
    const orders = introduced.map(unitOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
