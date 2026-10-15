import { describe, expect, it } from 'vitest';
import { atLeast, createEngine, emptyState, ManualClock, Placement, seededRng, validatePack, type ItemState } from '../../src/engine';
import {
  createMultiplicationPack,
  divisionDistractors,
  divisionInSquare,
  divisionNote,
  divisionStrategy,
  factId,
  isDivisionId,
  isShareId,
  parseDivisionId,
  SHARE_TASKS,
} from '../../src/content/multiplication';
import { progressFromSnapshot } from '../../src/shell/transfer';

const v1 = createMultiplicationPack();
const pack = createMultiplicationPack({ division: true });
const divisions = pack.items.filter((it) => isDivisionId(it.id));

describe('delat med in the garden pack', () => {
  it('is off by default, and version 2 with it', () => {
    expect(v1.version).toBe(1);
    expect(v1.items.some((it) => isDivisionId(it.id) || isShareId(it.id))).toBe(false);
    expect(pack.version).toBe(2);
    expect(() => validatePack(pack)).not.toThrow();
  });

  it('keeps the 100 multiplications first and in the same order, so old codes and backups still fit', () => {
    expect(pack.items.slice(0, 100).map((it) => it.id)).toEqual(v1.items.map((it) => it.id));
  });

  it('has one division per square: square a × b holds ab ÷ b = a', () => {
    expect(divisions).toHaveLength(100);
    for (const it of divisions) {
      const { dividend, divisor, quotient } = parseDivisionId(it.id);
      expect(Number(it.answer)).toBe(quotient);
      expect(dividend).toBe(quotient * divisor);
    }
    expect(divisionInSquare(3, 7)).toBe('21/7');
    expect(pack.items.find((it) => it.id === '21/7')!.answer).toBe('3');
  });

  it('lets a division wait for both multiplications of its family, and pairs the twins', () => {
    const d = pack.items.find((it) => it.id === '21/3')!;
    expect(d.requires).toEqual([factId(7, 3), factId(3, 7)]);
    expect(d.pairId).toBe('21/7');
    expect(pack.items.find((it) => it.id === '49/7')!.requires).toEqual([factId(7, 7)]);
  });

  it('puts a family in the division part of the first table it is in, after "Dela lika"', () => {
    const unitOf = (id: string) => pack.units.find((u) => u.itemIds.includes(id))!;
    expect(unitOf('21/3').id).toBe('d3');
    expect(unitOf('21/7').id).toBe('d3');
    expect(unitOf('56/8').id).toBe('d78');
    const share = pack.units.find((u) => u.id === 'delalika')!;
    expect(share.kind).toBe('understanding');
    expect(share.itemIds).toHaveLength(SHARE_TASKS.length);
    expect(share.unlockRule).toMatchObject({ kind: 'after', requires: ['u10'] });
    expect(pack.units.find((u) => u.id === 'd10')!.unlockRule).toMatchObject({ kind: 'after', requires: ['delalika'] });
  });

  it('weaves the division parts in after their tables, so a division comes soon after its family sits', () => {
    const order = [...pack.units].sort((a, b) => a.order - b.order).map((u) => u.id);
    expect(order.slice(0, 7)).toEqual(['u10', 'delalika', 'd10', 'u2', 'd2', 'u5', 'd5']);
    expect(pack.units.find((u) => u.id === 'u2')!.unlockRule).toMatchObject({ kind: 'after', requires: ['u10'] });
    expect(pack.units.find((u) => u.id === 'd2')!.unlockRule).toMatchObject({ kind: 'after', requires: ['d10'] });
    // Without delat med, the tables are as they always were.
    expect(v1.units.map((u) => u.unlockRule.kind)).toEqual(['always', ...new Array(9).fill('previous')]);
  });

  it('has both kinds of sharing: how many in each, and how many groups', () => {
    expect(new Set(SHARE_TASKS.map((t) => t.kind))).toEqual(new Set(['share', 'group']));
    for (const t of SHARE_TASKS) expect(t.answer * t.by).toBe(t.total);
  });

  it('thinks multiplication, halves, or goes via ten, and never shows a step it does not know', () => {
    expect(divisionStrategy(7, 3).text).toBe('21 ÷ 3 = 7: tänk gånger. 7 × 3 = 21.');
    expect(divisionStrategy(8, 2).kind).toBe('half');
    expect(divisionStrategy(8, 5).kind).toBe('viaTen');
    expect(divisionStrategy(4, 10).kind).toBe('ten');
    // A path starts from multiplications, or for ÷5 from the same number ÷10 (an earlier part).
    for (const it of divisions)
      for (const src of it.derivedFrom) {
        if (!isDivisionId(src)) continue;
        expect(parseDivisionId(src)).toMatchObject({ dividend: parseDivisionId(it.id).dividend, divisor: 10 });
        expect(parseDivisionId(it.id).divisor).toBe(5);
      }
  });

  it('offers the typical wrong answers and a friendly word for them', () => {
    const values = divisionDistractors(21, 3).map((c) => c.value);
    expect(values).toEqual(expect.arrayContaining(['6', '8', '3', '18', '63']));
    expect(values).not.toContain('7');
    expect(divisionNote(21, 3, '3')).toContain('det vi delar med');
    expect(divisionNote(21, 3, '63')).toContain('Delat med blir mindre');
    expect(divisionNote(21, 3, '8')).toContain('nära');
  });
});

describe('the engine with delat med', () => {
  const clock = new ManualClock(Date.UTC(2026, 2, 2, 12));
  const fluent = (id: string): ItemState => ({ ...emptyState(id), status: 'fluent', box: 3, dueDay: '2026-04-01', introducedDay: '2026-02-01' });

  it('introduces a division only when both multiplications of its family sit', () => {
    const engine = createEngine({ pack, clock, rng: seededRng(1) });
    const states = engine.initialStates();
    // Every ×10 fact sits, and "Dela lika" too; so does 2 × 10, but only one way of 3 × 10.
    for (const id of pack.units.find((u) => u.id === 'u10')!.itemIds) states[id] = fluent(id);
    for (const id of pack.units.find((u) => u.id === 'delalika')!.itemIds) states[id] = fluent(id);
    states['10x3'] = { ...states['10x3']!, status: 'learning', box: 1 };
    const meta = { ...engine.initialMeta(), unlockedUnitIds: engine.unlockedUnits(states, engine.initialMeta()) };
    expect(meta.unlockedUnitIds).toEqual(expect.arrayContaining(['u10', 'delalika', 'd10']));
    const session = engine.startSession({ states, meta, mode: 'daily' });
    const introduced = new Set<string>();
    for (let i = 0; i < 80 && !session.isOver(); i++) {
      const q = session.next();
      if (!q) break;
      if (q.kind === 'new') introduced.add(q.item.id);
      session.submit(q.item.answer, 1500);
      clock.advance(8000);
    }
    const newDivisions = [...introduced].filter(isDivisionId);
    expect(newDivisions.length).toBeGreaterThan(0);
    // 30 ÷ 3 and 30 ÷ 10 wait: 10 × 3 does not sit yet.
    expect(newDivisions).not.toContain('30/3');
    expect(newDivisions).not.toContain('30/10');
    for (const id of newDivisions) for (const r of pack.items.find((it) => it.id === id)!.requires!) expect(atLeast(states[r]!.status, 'fluent'), `${id} needs ${r}`).toBe(true);
  });

  it('takes turns between new multiplications and new divisions, multiplications first', () => {
    const engine = createEngine({ pack, clock, rng: seededRng(3) });
    const states = engine.initialStates();
    // A child who already knows ×10, ×2, ×5 and ×1, and "Dela lika": ×4 and many divisions are open.
    for (const u of ['u10', 'u2', 'u5', 'u1', 'delalika']) for (const id of pack.units.find((x) => x.id === u)!.itemIds) states[id] = fluent(id);
    const meta = { ...engine.initialMeta(), unlockedUnitIds: engine.unlockedUnits(states, engine.initialMeta()) };
    expect(meta.unlockedUnitIds).toEqual(expect.arrayContaining(['u4', 'd10']));
    const session = engine.startSession({ states, meta, mode: 'daily' });
    const introduced: string[] = [];
    for (let i = 0; i < 120 && !session.isOver(); i++) {
      const q = session.next();
      if (!q) break;
      if (q.kind === 'new') introduced.push(q.item.id);
      session.submit(q.item.answer, 1500);
      clock.advance(8000);
    }
    expect(introduced.length).toBeGreaterThanOrEqual(2);
    // ×4 does not wait for every open division, nor the divisions for ×4.
    expect(isDivisionId(introduced[0]!)).toBe(false);
    expect(introduced.slice(0, 2).some(isDivisionId)).toBe(true);
  });

  it('keeps the start check to the multiplications', () => {
    const placement = new Placement(pack, seededRng(2));
    const asked = new Set<string>();
    for (let item = placement.next(); item; item = placement.next()) {
      asked.add(item.id);
      placement.submit(item.answer, 1500);
    }
    expect([...asked].some((id) => isDivisionId(id) || isShareId(id))).toBe(false);
    expect(placement.result().passedUnitIds).toContain('u78');
  });

  it("reads a code from Gångerträdgården into the first 100 facts; the divisions start new", () => {
    const engine = createEngine({ pack, clock, rng: seededRng(3) });
    const levels = v1.items.map((_, i) => (i < 19 ? 4 : 0));
    const { states, meta } = progressFromSnapshot({ levels }, engine, clock.today());
    expect(states[v1.items[0]!.id]!.status).toBe('fluent');
    expect(divisions.every((it) => states[it.id]!.status === 'new')).toBe(true);
    expect(meta.unlockedUnitIds).toContain('u10');
    expect(() => progressFromSnapshot({ levels: [...levels, ...new Array(300).fill(0)] }, engine, clock.today())).toThrow();
  });
});
