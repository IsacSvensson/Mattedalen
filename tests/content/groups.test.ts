import { describe, expect, it } from 'vitest';
import { createEngine, emptyState, ManualClock, Placement, seededRng, validatePack, type ItemState } from '../../src/engine';
import { createMultiplicationPack, GROUP_TASKS, groupAnswer, groupId, groupText, isGroupId, TABLE_AFTER } from '../../src/content/multiplication';
import { knowsGroupsAlready } from '../../src/places/tradgarden/pack';

const pack = createMultiplicationPack({ division: true });
const at = (id: string, status: ItemState['status']): ItemState => ({ ...emptyState(id), status, box: 3 });

describe('"Lika stora grupper" (docs/PLAN-HUNDRA.md)', () => {
  it('comes first in the garden, as understanding, and ×2 builds on it', () => {
    expect(() => validatePack(pack)).not.toThrow();
    expect(pack.version).toBe(3);
    const order = [...pack.units].sort((a, b) => a.order - b.order).map((u) => u.id);
    expect(order[0]).toBe('lika');
    expect(order[1]).toBe('u2');
    const lika = pack.units.find((u) => u.id === 'lika')!;
    expect(lika.kind).toBe('understanding');
    expect(lika.itemIds).toHaveLength(16);
    expect(pack.units.find((u) => u.id === 'u2')!.unlockRule).toMatchObject({ kind: 'after', requires: ['lika'] });
  });

  it('has groups, repeated addition, hopping in steps, and zero and one, with right answers', () => {
    const kinds = new Set(GROUP_TASKS.map((t) => t.kind));
    expect(kinds).toEqual(new Set(['groups', 'repeat', 'skip']));
    expect(GROUP_TASKS.some((t) => t.kind === 'groups' && t.each === 0)).toBe(true);
    expect(GROUP_TASKS.some((t) => t.kind === 'groups' && t.each === 1)).toBe(true);
    expect(new Set(GROUP_TASKS.map(groupId)).size).toBe(GROUP_TASKS.length);
    for (const t of GROUP_TASKS) {
      const item = pack.items.find((it) => it.id === groupId(t))!;
      expect(item.answer).toBe(String(groupAnswer(t)));
      expect(pack.distractorCandidates(item).map((c) => c.value)).not.toContain(item.answer);
    }
    expect(groupText({ kind: 'groups', groups: 3, each: 4 })).toBe('3 korgar med 4 jordgubbar i varje. Hur många jordgubbar?');
    expect(groupText({ kind: 'repeat', groups: 3, each: 4, ask: 'groups' })).toBe('4 + 4 + 4 = __ × 4');
    expect(groupText({ kind: 'skip', step: 5, shown: 3 })).toBe('Hoppa 5 i taget: 5, 10, 15, __');
    expect(groupAnswer({ kind: 'skip', step: 5, shown: 3 })).toBe(20);
  });

  it('keeps old codes and backups: the 100 multiplications first, new items at the end', () => {
    const v1 = createMultiplicationPack();
    expect(pack.items.slice(0, 100).map((it) => it.id)).toEqual(v1.items.map((it) => it.id));
    expect(pack.items.slice(-16).every((it) => isGroupId(it.id))).toBe(true);
  });
});

describe('the tables as a graph', () => {
  it('opens each table after what its strategies build on', () => {
    expect(TABLE_AFTER).toMatchObject({ u10: ['u2'], u5: ['u10'], u4: ['u2'], u9: ['u10'], u6: ['u5'], u78: ['u6', 'u4'] });
    for (const [unit, after] of Object.entries(TABLE_AFTER)) expect(pack.units.find((u) => u.id === unit)!.unlockRule).toMatchObject({ kind: 'after', requires: after });
  });

  it('lets ×4 and ×3 open once ×2 sits, without waiting for ×10 and ×5', () => {
    const engine = createEngine({ pack, clock: new ManualClock(0), rng: seededRng(1) });
    const states = engine.initialStates();
    for (const u of ['lika', 'u2']) for (const id of pack.units.find((x) => x.id === u)!.itemIds) states[id] = at(id, 'fluent');
    const open = engine.unlockedUnits(states, engine.initialMeta());
    expect(open).toEqual(expect.arrayContaining(['u2', 'u10', 'u1', 'u4', 'u3']));
    expect(open).not.toContain('u5');
    expect(open).not.toContain('u9');
  });

  it('runs the start check through the graph: understanding is not tested, and does not hold ×2 back', () => {
    const placement = new Placement(pack, seededRng(2));
    const units = new Set<string>();
    for (let item = placement.next(); item; item = placement.next()) {
      units.add(item.unitId);
      placement.submit(item.answer, 1500);
    }
    expect(units.has('lika')).toBe(false);
    expect(placement.result().passedUnitIds[0]).toBe('u2');
    expect(placement.result().stoppedAt).toBeNull();
  });
});

describe('children who already play', () => {
  const twos = pack.focusSets!.find((s) => s.id === 't2')!.itemIds;

  it('count "Lika stora grupper" as known once at least half of ×2 sits', () => {
    const half = Object.fromEntries(twos.map((id, i) => [id, at(id, i < Math.ceil(twos.length / 2) ? 'fluent' : 'learning')]));
    const out = knowsGroupsAlready({ ...half, ...Object.fromEntries(GROUP_TASKS.map((t) => [groupId(t), emptyState(groupId(t))])) });
    for (const t of GROUP_TASKS) expect(out[groupId(t)]!.status).toBe('fluent');
  });

  it('leave a new child alone, and never touch tasks already started', () => {
    const fresh = Object.fromEntries(GROUP_TASKS.map((t) => [groupId(t), emptyState(groupId(t))]));
    expect(knowsGroupsAlready(fresh)).toBe(fresh);
    const started = { ...fresh, 'lika:skip:2': at('lika:skip:2', 'learning'), ...Object.fromEntries(twos.map((id) => [id, at(id, 'fluent')])) };
    expect(knowsGroupsAlready(started)).toBe(started);
  });
});
