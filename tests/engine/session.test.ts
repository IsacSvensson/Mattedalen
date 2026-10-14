import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildChoices,
  createEngine,
  makeConfig,
  ManualClock,
  seededRng,
  type Engine,
  type ItemState,
  type Question,
  type Session,
} from '../../src/engine';
import { createWordPack, knownState } from './fixtures';

const START = Date.UTC(2026, 1, 2, 15, 0);
const TODAY = '2026-02-02';

function setup(overrides = {}, seed = 1) {
  const clock = new ManualClock(START);
  const engine = createEngine({ pack: createWordPack(), clock, rng: seededRng(seed), config: makeConfig(overrides) });
  return { clock, engine };
}

/** Answer every question (correct unless `wrong` says otherwise) until the session ends. */
function run(session: Session, clock: ManualClock, wrong: (q: Question) => boolean = () => false, stepMs = 5000) {
  const asked: Question[] = [];
  for (let q = session.next(); q; q = session.next()) {
    asked.push(q);
    clock.advance(stepMs);
    session.submit(wrong(q) ? 'fel' : q.item.answer, 2000);
  }
  return asked;
}

function knownAnimals(engine: Engine, status: ItemState['status'] = 'fluent', dueDay = addDays(TODAY, 3)) {
  const states = engine.initialStates();
  for (const id of ['hund', 'katt', 'häst', 'ko', 'gris', 'får']) states[id] = knownState(id, status, dueDay);
  return states;
}

describe('session basics', () => {
  it('starts a first-ever session with a new item, asked as multiple choice', () => {
    const { engine } = setup();
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    const q = s.next()!;
    expect(q.kind).toBe('new');
    expect(q.item.id).toBe('hund');
    expect(q.format).toBe('choice');
    expect(q.choices).toContain('dog');
    expect(q.choices).toHaveLength(4);
  });

  it('every step is a question that needs an answer', () => {
    const { engine } = setup();
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    const q = s.next();
    expect(s.next()).toBe(q); // idempotent until answered
    s.submit('dog', 1500);
    expect(() => s.submit('dog', 1500)).toThrow();
  });

  it('ends after the configured time; the current question may be finished', () => {
    const { engine, clock } = setup({ session: { durationMs: 60_000 } });
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    const asked = run(s, clock);
    expect(asked.length).toBe(12); // 12 × 5 s = 60 s
    expect(s.isOver()).toBe(true);
    expect(s.next()).toBeNull();
  });

  it('reports how much of its time has passed', () => {
    const { engine, clock } = setup({ session: { durationMs: 60_000 } });
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    expect(s.progress()).toBe(0);
    clock.advance(15_000);
    expect(s.progress()).toBe(0.25);
    clock.advance(120_000);
    expect(s.progress()).toBe(1);
  });

  it('can be ended early', () => {
    const { engine } = setup();
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    s.next();
    s.end();
    expect(s.next()).toBeNull();
  });

  it('is deterministic for a given seed', () => {
    const ids = (seed: number) => {
      const { engine, clock } = setup({}, seed);
      return run(engine.startSession({ states: knownAnimals(engine), meta: engine.initialMeta(), sessionId: 's' }), clock).map(
        (q) => `${q.kind}:${q.item.id}:${q.choices?.join('/')}`,
      );
    };
    expect(ids(5)).toEqual(ids(5));
    expect(ids(5)).not.toEqual(ids(6));
  });

  it('never asks the same item twice in a row when there is a choice', () => {
    const { engine, clock } = setup();
    const asked = run(engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() }), clock, (q) => q.seq % 4 === 0);
    for (let i = 1; i < asked.length; i++) expect(asked[i]!.item.id).not.toBe(asked[i - 1]!.item.id);
  });
});

describe('session composition', () => {
  it('warms up with safe, known items before anything new', () => {
    const { engine } = setup();
    const states = knownAnimals(engine, 'automatic');
    const s = engine.startSession({ states, meta: { ...engine.initialMeta(), unlockedUnitIds: ['animals', 'colours'] } });
    const kinds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const q = s.next()!;
      kinds.push(q.kind);
      s.submit(q.item.answer, 1500);
    }
    expect(kinds).toEqual(['warmup', 'warmup', 'warmup', 'warmup', 'warmup']);
  });

  it('introduces new items one at a time between known ones (incremental rehearsal)', () => {
    const { engine, clock } = setup();
    const states = knownAnimals(engine);
    const meta = { ...engine.initialMeta(), unlockedUnitIds: ['animals', 'colours'], pacingGap: 7 };
    const asked = run(engine.startSession({ states, meta }), clock, () => false, 8000);
    const newIdx = asked.flatMap((q, i) => (q.kind === 'new' ? [i] : []));
    expect(newIdx.length).toBeGreaterThan(0);
    for (let k = 1; k < newIdx.length; k++) {
      const between = asked.slice(newIdx[k - 1]! + 1, newIdx[k]!);
      const known = between.filter((q) => q.kind !== 'rehearse' && q.kind !== 'new').length;
      expect(known).toBeGreaterThanOrEqual(engine.config.pacing.minGap);
    }
  });

  it('rehearses a new item several times in the same session', () => {
    const { engine, clock } = setup();
    const asked = run(engine.startSession({ states: knownAnimals(engine), meta: { ...engine.initialMeta(), unlockedUnitIds: ['animals', 'colours'] } }), clock);
    const first = asked.find((q) => q.kind === 'new')!;
    const rehearsals = asked.filter((q) => q.item.id === first.item.id && q.kind === 'rehearse');
    expect(rehearsals.length).toBe(engine.config.session.rehearsalGaps.length);
  });

  it('asks a wrongly answered item again later in the same session', () => {
    const { engine, clock } = setup();
    let failed = false;
    const asked = run(
      engine.startSession({ states: knownAnimals(engine, 'fluent', TODAY), meta: engine.initialMeta() }),
      clock,
      (q) => {
        if (!failed && q.item.id === 'katt') return (failed = true);
        return false;
      },
    );
    const idx = asked.findIndex((q) => q.item.id === 'katt');
    const retry = asked.findIndex((q, i) => i > idx && q.item.id === 'katt' && q.kind === 'retry');
    expect(retry).toBeGreaterThan(idx + 1);
  });

  it('reviews items that are due', () => {
    const { engine, clock } = setup();
    const states = knownAnimals(engine, 'learning', addDays(TODAY, 5));
    states.ko = knownState('ko', 'learning', TODAY, 1);
    const asked = run(engine.startSession({ states, meta: engine.initialMeta() }), clock);
    expect(asked.some((q) => q.item.id === 'ko' && q.kind === 'due')).toBe(true);
  });

  it('introduces fewer new items when few are known', () => {
    const { engine, clock } = setup({ session: { durationMs: 30 * 60_000 } });
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    run(s, clock);
    const many = setup({ session: { durationMs: 30 * 60_000 } });
    const s2 = many.engine.startSession({
      states: knownAnimals(many.engine),
      meta: { ...many.engine.initialMeta(), unlockedUnitIds: ['animals', 'colours'] },
    });
    run(s2, many.clock);
    expect(s.summary().introduced.length).toBeLessThanOrEqual(s2.summary().introduced.length);
    expect(s2.summary().introduced.length).toBeLessThanOrEqual(engine.config.pacing.maxNewPerSession);
  });

  it('only introduces items from unlocked units', () => {
    const { engine, clock } = setup();
    const asked = run(engine.startSession({ states: knownAnimals(engine, 'learning'), meta: engine.initialMeta() }), clock);
    expect(asked.filter((q) => q.kind === 'new')).toHaveLength(0);
  });

  it('extra practice after the daily session introduces nothing new', () => {
    const { engine, clock } = setup();
    const meta = { ...engine.initialMeta(), unlockedUnitIds: ['animals', 'colours'] };
    const asked = run(engine.startSession({ states: knownAnimals(engine), meta, mode: 'extra' }), clock);
    expect(asked.length).toBeGreaterThan(10);
    expect(asked.every((q) => q.kind !== 'new' && q.kind !== 'warmup')).toBe(true);
  });
});

describe('answer formats', () => {
  it('uses free input once an item is fluent', () => {
    const { engine } = setup();
    const s = engine.startSession({ states: knownAnimals(engine, 'fluent'), meta: engine.initialMeta() });
    expect(s.next()!.format).toBe('free');
  });

  it('can be limited to multiple choice', () => {
    const { engine } = setup({ format: { allowFree: false } });
    const s = engine.startSession({ states: knownAnimals(engine, 'automatic'), meta: engine.initialMeta() });
    const q = s.next()!;
    expect(q.format).toBe('choice');
    expect(q.choices).toBeDefined();
  });

  it('distractors are unique, exclude the answer and favour earlier mistakes', () => {
    const pack = createWordPack();
    const item = pack.items[0]!;
    const state = { ...knownState(item.id, 'learning', TODAY), confusions: { cow: 5 } };
    let cowShown = 0;
    for (let seed = 0; seed < 200; seed++) {
      const choices = buildChoices(pack, item, state, seededRng(seed), 4);
      expect(new Set(choices).size).toBe(4);
      expect(choices.filter((c) => c === 'dog')).toHaveLength(1);
      if (choices.includes('cow')) cowShown++;
    }
    // Uniform would be 3 of 11 ≈ 27 %; the learner's own confusion should dominate.
    expect(cowShown / 200).toBeGreaterThan(0.6);
  });
});

describe('summary', () => {
  it('reports results and updated learner meta', () => {
    const { engine, clock } = setup({ session: { durationMs: 2 * 60_000 } });
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    run(s, clock, (q) => q.seq === 3);
    const sum = s.summary();
    expect(sum.answered).toBeGreaterThan(10);
    expect(sum.correct).toBe(sum.answered - 1);
    expect(sum.meta.sessionsCompleted).toBe(1);
    expect(sum.meta.lastSessionDay).toBe(TODAY);
    expect(engine.dailyDone(sum.meta)).toBe(true);
    expect(sum.introduced.length).toBeGreaterThan(0);
  });

  it('a session ended early does not count as the day\'s session', () => {
    const { engine, clock } = setup();
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta() });
    const q = s.next()!;
    clock.advance(60_000);
    s.submit(q.item.answer, 2000);
    s.end();
    const sum = s.summary();
    expect(sum.completed).toBe(false);
    expect(sum.meta.sessionsCompleted).toBe(0);
    expect(engine.dailyDone(sum.meta)).toBe(false);
    expect(sum.answered).toBe(1);
  });

  it('records attempts with time, format and the given answer', () => {
    const { engine } = setup();
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta(), sessionId: 'abc' });
    const q = s.next()!;
    const fb = s.submit(' Cat ', 3456);
    expect(fb.correct).toBe(false);
    expect(fb.attempt).toMatchObject({ itemId: q.item.id, sessionId: 'abc', format: 'choice', given: 'cat', correct: false, rtMs: 3456, kind: 'new' });
    expect(fb.state.confusions).toEqual({ cat: 1 });
  });
});

describe('focus sessions', () => {
  const COLOURS = ['röd', 'blå', 'grön', 'gul', 'vit', 'svart'];

  it('introduces a few new items from the focus set, even in a locked unit', () => {
    const { engine, clock } = setup({ session: { durationMs: 5 * 60_000 } });
    const meta = engine.initialMeta();
    expect(engine.unlockedUnits(knownAnimals(engine, 'learning'), meta)).toEqual(['animals']);
    const s = engine.startSession({ states: knownAnimals(engine, 'learning'), meta, mode: 'focus', focusItemIds: COLOURS });
    const asked = run(s, clock);
    const introduced = asked.filter((q) => q.kind === 'new').map((q) => q.item.id);
    expect(introduced.length).toBeGreaterThan(0);
    expect(introduced.length).toBeLessThanOrEqual(engine.config.focus.maxNew);
    for (const id of introduced) expect(COLOURS).toContain(id);
    // Introduced colours are practised, but the unit itself is not unlocked by it.
    expect(asked.filter((q) => COLOURS.includes(q.item.id) && q.kind !== 'new').length).toBeGreaterThan(introduced.length);
    expect(s.summary().meta.unlockedUnitIds).toEqual(['animals']);
  });

  it('asks mostly, but not only, items from the focus set', () => {
    const focus = ['hund', 'katt', 'häst'];
    const { engine, clock } = setup({ session: { durationMs: 5 * 60_000 } }, 7);
    const s = engine.startSession({ states: knownAnimals(engine), meta: engine.initialMeta(), mode: 'focus', focusItemIds: focus });
    const asked = run(s, clock).filter((q) => q.kind !== 'new' && q.kind !== 'rehearse');
    const share = asked.filter((q) => focus.includes(q.item.id)).length / asked.length;
    expect(asked.length).toBeGreaterThan(40);
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.9);
  });

  it('never asks the same item twice in a row when there is a choice', () => {
    const { engine, clock } = setup({ session: { durationMs: 5 * 60_000 } }, 3);
    const s = engine.startSession({ states: knownAnimals(engine), meta: engine.initialMeta(), mode: 'focus', focusItemIds: ['hund'] });
    const asked = run(s, clock);
    for (let i = 1; i < asked.length; i++) expect(asked[i]!.item.id).not.toBe(asked[i - 1]!.item.id);
  });

  it('does not count as the daily session and needs a focus set', () => {
    const { engine, clock } = setup({ session: { durationMs: 60_000 } });
    const meta = engine.initialMeta();
    const s = engine.startSession({ states: knownAnimals(engine), meta, mode: 'focus', focusItemIds: ['hund', 'katt'] });
    run(s, clock);
    const summary = s.summary();
    expect(summary.mode).toBe('focus');
    expect(summary.completed).toBe(true);
    expect(summary.meta.sessionsCompleted).toBe(0);
    expect(summary.meta.lastSessionDay).toBeNull();
    expect(() => engine.startSession({ states: knownAnimals(engine), meta, mode: 'focus' })).toThrow();
  });

  it('works for a learner who knows nothing yet', () => {
    const { engine, clock } = setup({ session: { durationMs: 60_000 } });
    const s = engine.startSession({ states: engine.initialStates(), meta: engine.initialMeta(), mode: 'focus', focusItemIds: COLOURS });
    const asked = run(s, clock);
    expect(asked[0]?.kind).toBe('new');
    for (const q of asked) expect(COLOURS).toContain(q.item.id);
  });
});
