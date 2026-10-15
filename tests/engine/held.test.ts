import { describe, expect, it } from 'vitest';
import { applyPlacement, computeUnlocked, createEngine, DEFAULT_CONFIG, emptyState, ManualClock, seededRng, type ItemState } from '../../src/engine';
import { createWordPack } from './fixtures';

/** Units held back by something outside the pack (`heldUnitIds`, `Held`). */

const pack = createWordPack();
const animals = pack.units.find((u) => u.id === 'animals')!.itemIds;
const colours = pack.units.find((u) => u.id === 'colours')!.itemIds;
const at = (id: string, status: ItemState['status']): ItemState => ({ ...emptyState(id), status, box: 3, dueDay: '2026-04-01', introducedDay: '2026-01-01' });
const knownAnimals = () => Object.fromEntries(animals.map((id) => [id, at(id, 'fluent')]));

describe('held units', () => {
  it('do not open by their own rule while held', () => {
    expect(computeUnlocked(pack.units, knownAnimals(), [])).toEqual(['animals', 'colours']);
    expect(computeUnlocked(pack.units, knownAnimals(), [], undefined, undefined, new Set(['colours']))).toEqual(['animals']);
  });

  it('never close what is open, and never hold what is started', () => {
    expect(computeUnlocked(pack.units, knownAnimals(), ['colours'], undefined, undefined, new Set(['colours']))).toEqual(['animals', 'colours']);
    const started = { ...knownAnimals(), [colours[0]!]: at(colours[0]!, 'learning') };
    expect(computeUnlocked(pack.units, started, [], undefined, undefined, new Set(['colours']))).toEqual(['animals', 'colours']);
  });

  it('keep a session to what is open: no new items from a held unit, review goes on', () => {
    const clock = new ManualClock(Date.UTC(2026, 2, 2, 12));
    const engine = createEngine({ pack, clock, rng: seededRng(1) });
    const states = { ...engine.initialStates(), ...knownAnimals() };
    const meta = engine.initialMeta();
    expect(engine.unlockedUnits(states, meta, [], ['colours'])).toEqual(['animals']);
    const session = engine.startSession({ states, meta, heldUnitIds: ['colours'] });
    const asked = new Set<string>();
    for (let q = session.next(); q; q = session.next()) {
      asked.add(q.item.id);
      session.submit(q.item.answer, 1500);
      clock.advance(6000);
    }
    expect([...asked].some((id) => colours.includes(id))).toBe(false);
    expect(asked.size).toBeGreaterThan(0);
  });

  it('hold in focus practice too, which otherwise may open a unit early', () => {
    const clock = new ManualClock(Date.UTC(2026, 2, 2, 12));
    const engine = createEngine({ pack, clock, rng: seededRng(2) });
    // The animals are only half known, so the colours are not open by their rule: only focus could open them.
    const states = { ...engine.initialStates(), ...Object.fromEntries(animals.slice(0, 3).map((id) => [id, at(id, 'fluent')])) };
    expect(engine.unlockedUnits(states, engine.initialMeta())).toEqual(['animals']);
    const run = (held: string[]) => {
      const session = engine.startSession({ states, meta: engine.initialMeta(), mode: 'focus', focusItemIds: colours, heldUnitIds: held });
      const introduced: string[] = [];
      for (let q = session.next(); q && introduced.length < 3; q = session.next()) {
        if (q.kind === 'new') introduced.push(q.item.id);
        session.submit(q.item.answer, 1500);
        clock.advance(6000);
      }
      return introduced;
    };
    expect(run([]).length).toBeGreaterThan(0);
    expect(run(['colours'])).toEqual([]);
  });

  it('open in a start check only when passed: a failed held unit waits', () => {
    const states = Object.fromEntries(pack.items.map((it) => [it.id, emptyState(it.id)]));
    const meta = { pacingGap: 8, unlockedUnitIds: ['animals'], accuracyEma: null, sessionsCompleted: 0, lastSessionDay: null };
    const failed = { passedUnitIds: ['animals'], fluentUnitIds: ['animals'], stoppedAt: 'colours', failedUnitIds: ['colours'], answers: [] };
    expect(applyPlacement(pack, DEFAULT_CONFIG, failed, states, meta, '2026-03-02', ['colours']).meta.unlockedUnitIds).toEqual(['animals']);
    expect(applyPlacement(pack, DEFAULT_CONFIG, failed, states, meta, '2026-03-02').meta.unlockedUnitIds).toEqual(['animals', 'colours']);
    const passed = { passedUnitIds: ['animals', 'colours'], fluentUnitIds: ['animals', 'colours'], stoppedAt: null, answers: [] };
    expect(applyPlacement(pack, DEFAULT_CONFIG, passed, states, meta, '2026-03-02', ['colours']).meta.unlockedUnitIds).toEqual(['animals', 'colours']);
  });
});
