import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyStatus,
  createEngine,
  DEFAULT_CONFIG,
  emptyState,
  isStruggling,
  makeConfig,
  ManualClock,
  seededRng,
  type ContentPack,
  type ItemState,
  type Question,
  type Session,
} from '../../src/engine';
import { createWordPack, knownState } from './fixtures';

const START = Date.UTC(2026, 1, 2, 15, 0);
const TODAY = '2026-02-02';
const cfg = DEFAULT_CONFIG.support;

/** The word pack, where "häst" and "ko" can be derived from "hund" and "katt". */
function derivablePack(): ContentPack {
  const pack = createWordPack();
  for (const item of pack.items) if (item.id === 'häst' || item.id === 'ko') item.derivedFrom = ['hund', 'katt'];
  return pack;
}

function setup(overrides = {}) {
  const clock = new ManualClock(START);
  const engine = createEngine({ pack: derivablePack(), clock, rng: seededRng(5), config: makeConfig({ session: { durationMs: 5 * 60_000 }, ...overrides }) });
  return { clock, engine };
}

/** Practised for a few days (not "stuck"); `extra` makes it hard. */
const learning = (id: string, extra: Partial<ItemState> = {}): ItemState => ({ ...knownState(id, 'learning', TODAY, 1), introducedDay: addDays(TODAY, -3), ...extra });
const hard = (id: string): ItemState => learning(id, { wrongDays: 2 });

function startWith(engine: ReturnType<typeof setup>['engine'], extra: Record<string, ItemState>) {
  const states = engine.initialStates();
  for (const id of ['hund', 'katt', 'gris', 'får']) states[id] = knownState(id, 'fluent', addDays(TODAY, 3));
  Object.assign(states, extra);
  return engine.startSession({ states, meta: engine.initialMeta() });
}

function run(session: Session, clock: ManualClock, stepMs = 5000) {
  const asked: Question[] = [];
  for (let q = session.next(); q; q = session.next()) {
    asked.push(q);
    clock.advance(stepMs);
    session.submit(q.item.answer, 2000);
  }
  return asked;
}

describe('hard items', () => {
  it('are items wrong on several days, fallen back twice or stuck for long', () => {
    expect(isStruggling(hard('häst'), TODAY, cfg)).toBe(true);
    expect(isStruggling({ ...hard('häst'), wrongDays: 1 }, TODAY, cfg)).toBe(false);
    expect(isStruggling(learning('häst'), TODAY, cfg)).toBe(false);
    expect(isStruggling(learning('häst', { drops: 2 }), TODAY, cfg)).toBe(true);
    expect(isStruggling(learning('häst', { introducedDay: addDays(TODAY, -8) }), TODAY, cfg)).toBe(true);
    expect(isStruggling(learning('häst', { introducedDay: addDays(TODAY, -7) }), TODAY, cfg)).toBe(false);
    // After settling, the waiting time counts from that day.
    expect(isStruggling(learning('häst', { introducedDay: addDays(TODAY, -30), settledDay: addDays(TODAY, -2) }), TODAY, cfg)).toBe(false);
    // Known items and items not started are never "hard".
    expect(isStruggling({ ...hard('häst'), status: 'fluent' }, TODAY, cfg)).toBe(false);
    expect(isStruggling({ ...emptyState('häst'), wrongDays: 3 }, TODAY, cfg)).toBe(false);
  });

  it('count wrong days (not wrong answers) and falls from fluent', () => {
    const s = DEFAULT_CONFIG.status;
    const wrong = (prev: ItemState, today: string) => applyStatus(prev, { correct: false, given: 'x', rtMs: 3000, format: 'free', now: 0, today }, s);
    let st = knownState('häst', 'fluent', TODAY);
    st = wrong(st, TODAY);
    st = wrong(st, TODAY);
    expect(st.wrongDays).toBe(1);
    expect(st.drops).toBe(1);
    st = wrong(st, addDays(TODAY, 1));
    expect(st.wrongDays).toBe(2);
    expect(st.drops).toBe(1); // already learning: no new fall
  });

  it('settle when answered from memory on a later day than the support', () => {
    const s = DEFAULT_CONFIG.status;
    const tomorrow = addDays(TODAY, 1);
    const before: ItemState = { ...hard('häst'), supportDay: TODAY, introducedDay: addDays(TODAY, -20), lastWrongDay: TODAY };
    const after = applyStatus(before, { correct: true, given: 'horse', rtMs: 2500, format: 'free', now: 0, today: tomorrow }, s);
    expect(after.wrongDays).toBe(0);
    expect(after.supportDay).toBeUndefined();
    expect(after.settledDay).toBe(tomorrow);
    expect(isStruggling(after, tomorrow, cfg)).toBe(false);
  });
});

describe('supported questions in a session', () => {
  it('ask a hard item in steps first, then from memory a few questions later', () => {
    const { engine, clock } = setup();
    const s = startWith(engine, { häst: hard('häst') });
    const asked = run(s, clock);
    const derive = asked.findIndex((q) => q.item.id === 'häst' && q.kind === 'derive');
    expect(derive).toBeGreaterThanOrEqual(0);
    expect(asked[derive]!.format).toBe('free');
    const again = asked.findIndex((q, i) => i > derive && q.item.id === 'häst');
    expect(asked[again]!.kind).toBe('retry');
    expect(again - derive).toBeLessThanOrEqual(engine.config.session.retryGap + 2);
    // Only once per day.
    expect(asked.filter((q) => q.kind === 'derive')).toHaveLength(1);
  });

  it('give no status evidence for the supported answer itself', () => {
    const { engine } = setup();
    const s = startWith(engine, { häst: hard('häst') });
    let q = s.next();
    while (q && q.kind !== 'derive') {
      s.submit(q.item.answer, 2000);
      q = s.next();
    }
    const before = s.stateRecord()['häst']!;
    const fb = s.submit('horse', 1500);
    expect(fb.attempt.kind).toBe('derive');
    expect(fb.state.dayBest).toEqual(before.dayBest);
    expect(fb.state.status).toBe(before.status);
    expect(fb.state.box).toBe(before.box);
    expect(fb.state.supportDay).toBe(TODAY);
    // Getting a supported answer wrong does not push the item down either.
    expect(s.stateRecord()['häst']!.lapses).toBe(before.lapses);
  });

  it('need the underlying items to be known, free answers, and stay few per session', () => {
    const { engine, clock } = setup({ support: { maxPerSession: 1 } });
    const asked = run(startWith(engine, { häst: hard('häst'), ko: hard('ko') }), clock);
    expect(asked.filter((q) => q.kind === 'derive')).toHaveLength(1);

    const unknownBase = setup();
    const states = { häst: hard('häst'), katt: learning('katt') };
    expect(run(startWith(unknownBase.engine, states), unknownBase.clock).some((q) => q.kind === 'derive')).toBe(false);

    const noFree = setup({ format: { allowFree: false } });
    expect(run(startWith(noFree.engine, { häst: hard('häst') }), noFree.clock).some((q) => q.kind === 'derive')).toBe(false);
  });
});
