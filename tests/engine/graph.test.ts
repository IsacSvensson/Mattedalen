import { describe, expect, it } from 'vitest';
import {
  computeUnlocked,
  createEngine,
  emptyState,
  makeConfig,
  ManualClock,
  requiredCount,
  seededRng,
  validatePack,
  type ContentPack,
  type ItemState,
  type Question,
  type Unit,
} from '../../src/engine';
import { createWordPack, knownState } from './fixtures';

const START = Date.UTC(2026, 1, 2, 15, 0);
const TODAY = '2026-02-02';

const unit = (id: string, order: number, itemIds: string[], unlockRule: Unit['unlockRule']): Unit => ({ id, title: id, order, itemIds, unlockRule });
const fluent = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, knownState(id, 'fluent', '2026-02-05')]));
const after = (requires: string[]): Unit['unlockRule'] => ({ kind: 'after', requires, fraction: 0.8, minStatus: 'fluent' });

/**
 *   a ─┬─ b ─┐
 *      └─ c ─┴─ d
 */
const GRAPH: Unit[] = [
  unit('a', 0, ['a1', 'a2', 'a3', 'a4', 'a5'], { kind: 'always' }),
  unit('b', 1, ['b1', 'b2', 'b3', 'b4', 'b5'], after(['a'])),
  unit('c', 2, ['c1', 'c2', 'c3', 'c4', 'c5'], after(['a'])),
  unit('d', 3, ['d1', 'd2'], after(['b', 'c'])),
];

describe('a knowledge graph of units', () => {
  it('opens a unit when every prerequisite is known well enough, in any branch', () => {
    expect(computeUnlocked(GRAPH, {}, [])).toEqual(['a']);
    // 4 of 5 in a: both branches open, but not what needs both.
    expect(computeUnlocked(GRAPH, fluent(['a1', 'a2', 'a3', 'a4']), [])).toEqual(['a', 'b', 'c']);
    const ab = fluent(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4']);
    expect(computeUnlocked(GRAPH, ab, [])).toEqual(['a', 'b', 'c']);
    expect(computeUnlocked(GRAPH, { ...ab, ...fluent(['c1', 'c2', 'c3', 'c4']) }, [])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never closes a unit again', () => {
    expect(computeUnlocked(GRAPH, {}, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('opens earlier for a learner above the target band', () => {
    expect(computeUnlocked(GRAPH, fluent(['a1', 'a2', 'a3']), [], 0.6)).toEqual(['a', 'b', 'c']);
  });

  it('does not count excluded items: half a unit held out can still open what follows', () => {
    const excluded = new Set(['a3', 'a4', 'a5']);
    expect(requiredCount(GRAPH[0]!, 0.8, excluded)).toBe(1);
    expect(requiredCount(unit('x', 9, ['x1'], { kind: 'always' }), 0.8, new Set(['x1']))).toBe(0);
    expect(computeUnlocked(GRAPH, fluent(['a1', 'a2']), [], undefined, excluded)).toEqual(['a', 'b', 'c']);
    expect(computeUnlocked(GRAPH, fluent(['a1', 'a2']), [])).toEqual(['a']);
  });

  it('rejects edges to unknown or later units', () => {
    const pack = (units: Unit[]): ContentPack => ({
      ...createWordPack(),
      items: units.flatMap((u) => u.itemIds.map((id, order) => ({ id, prompt: id, answer: id, unitId: u.id, tags: [], derivedFrom: [], hints: [], order }))),
      units,
    });
    expect(() => validatePack(pack(GRAPH))).not.toThrow();
    expect(() => validatePack(pack([GRAPH[0]!, unit('b', 1, ['b1'], after(['zz']))]))).toThrow(/unknown unit zz/);
    expect(() => validatePack(pack([GRAPH[0]!, unit('b', 1, ['b1'], after(['c'])), unit('c', 2, ['c1'], after(['a']))]))).toThrow(
      /does not come before/,
    );
  });
});

function setup(pack: ContentPack, seed = 1) {
  const clock = new ManualClock(START);
  const engine = createEngine({ pack, clock, rng: seededRng(seed) });
  return { clock, engine };
}

function run(engine: ReturnType<typeof createEngine>, clock: ManualClock, states: Record<string, ItemState>, excludedItemIds?: string[]) {
  const session = engine.startSession({ states, meta: engine.initialMeta(), excludedItemIds });
  const asked: Question[] = [];
  for (let q = session.next(); q; q = session.next()) {
    asked.push(q);
    clock.advance(5000);
    session.submit(q.item.answer, 2000);
  }
  return { session, asked };
}

describe('excluded items', () => {
  it('are never asked, not even as new items or when due', () => {
    const pack = createWordPack();
    const { clock, engine } = setup(pack);
    const states = { ...engine.initialStates(), hund: knownState('hund', 'fluent', TODAY), katt: knownState('katt', 'learning', TODAY) };
    const { asked, session } = run(engine, clock, states, ['hund', 'häst', 'ko']);
    const ids = new Set(asked.map((q) => q.item.id));
    for (const id of ['hund', 'häst', 'ko']) expect(ids.has(id)).toBe(false);
    expect(ids.has('katt')).toBe(true);
    // Their states are kept as they were.
    expect(session.stateRecord().hund).toEqual(states.hund);
  });
});

describe('several forms of an item', () => {
  const formsPack = (evidence: boolean): ContentPack => ({
    ...createWordPack(),
    present: (item, { state }) =>
      state.seen < 2 ? { variant: 'standard', prompt: item.prompt } : { variant: 'reversed', prompt: `? = ${item.prompt}`, evidence },
  });

  it('shows the pack form and stores it with the attempt; the answer stays the same', () => {
    const { clock, engine } = setup(formsPack(true));
    const session = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    const seen: { prompt: string; variant?: string; attemptVariant?: string }[] = [];
    for (let q = session.next(); q && seen.length < 40; q = session.next()) {
      clock.advance(5000);
      const fb = session.submit(q.item.answer, 2000);
      expect(fb.correct).toBe(true);
      seen.push({ prompt: q.prompt, variant: q.variant, attemptVariant: fb.attempt.variant });
    }
    expect(seen.some((s) => s.variant === 'standard')).toBe(true);
    expect(seen.some((s) => s.variant === 'reversed' && s.prompt.startsWith('? = '))).toBe(true);
    for (const s of seen) expect(s.attemptVariant).toBe(s.variant);
  });

  it('a form marked as no evidence never promotes the item', () => {
    for (const evidence of [true, false]) {
      const { clock, engine } = setup(formsPack(evidence));
      let states: Record<string, ItemState> = { ...engine.initialStates(), hund: { ...knownState('hund', 'learning', '2026-02-01', 1), seen: 5 } };
      // Right and fast on two later days, only ever in the reversed form.
      for (let day = 0; day < 2; day++) {
        clock.set(START + (day + 1) * 86_400_000);
        const session = engine.startSession({ states, meta: engine.initialMeta(), mode: 'focus', focusItemIds: ['hund'] });
        for (let q = session.next(); q; q = session.next()) {
          clock.advance(5000);
          session.submit(q.item.answer, 1500);
        }
        states = session.stateRecord();
      }
      expect(states.hund!.status).toBe(evidence ? 'fluent' : 'learning');
    }
  });

  it('without forms, attempts carry no variant and the prompt is the item prompt', () => {
    const { clock, engine } = setup(createWordPack());
    const { asked } = run(engine, clock, engine.initialStates());
    for (const q of asked) {
      expect(q.prompt).toBe(q.item.prompt);
      expect(q).not.toHaveProperty('variant');
    }
  });
});

describe('settings per pack', () => {
  it('apply before the game settings, which win', () => {
    const pack: ContentPack = { ...createWordPack(), config: { status: { automaticRtMs: 4000 }, session: { warmupCount: 2 } } };
    expect(createEngine({ pack }).config.status.automaticRtMs).toBe(4000);
    const config = makeConfig(pack.config ?? {}, { session: { warmupCount: 7 } });
    expect(config.status.automaticRtMs).toBe(4000);
    expect(config.status.fluentRtMs).toBe(5000);
    expect(config.session.warmupCount).toBe(7);
    expect(emptyState('x').status).toBe('new');
  });
});
