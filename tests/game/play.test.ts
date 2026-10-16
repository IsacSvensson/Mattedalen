import { describe, expect, it } from 'vitest';
import { ManualClock, seededRng } from '../../src/engine';
import { createMultiplicationPack } from '../../src/content/multiplication';
import { DEFAULT_SETTINGS, MemoryProgressStore, type Profile } from '../../src/storage';
import { EXTRA_PRACTICE_MINUTES, loadProgress, PlayController, type GameDeps } from '../../src/shell/play';
import { genitive, knownTables } from '../../src/places/tradgarden/screens/garden';
import { stageFor } from '../../src/shell/components/plant';
import { keepTerms } from '../../src/shell/words';
import { emptyState } from '../../src/engine';

const profile: Profile = { id: 'p1', name: 'Alva', avatar: '🦊', createdAt: 0, settings: { ...DEFAULT_SETTINGS, sessionMinutes: 10 } };

function setup() {
  const clock = new ManualClock(Date.UTC(2026, 1, 2, 15));
  const store = new MemoryProgressStore();
  const deps: GameDeps = { store, pack: createMultiplicationPack({ maxUnits: 6 }), clock, rng: seededRng(3), allowFree: false };
  return { clock, store, deps };
}

async function playAll(play: PlayController, clock: ManualClock) {
  for (let q = play.question(); q; q = play.question()) {
    clock.advance(6000);
    await play.answer(q.item.answer, 2000);
  }
  return play.finish();
}

describe('PlayController', () => {
  it('runs a full daily session and stores everything', async () => {
    const { clock, store, deps } = setup();
    const play = await PlayController.start(profile, deps);
    const summary = await playAll(play, clock);
    expect(summary.completed).toBe(true);
    expect(summary.answered).toBe(100); // 10 min / 6 s
    expect(await store.countAttempts('p1')).toBe(100);
    const saved = (await store.load('p1', 'multiplication'))!;
    expect(saved.meta.lastSessionDay).toBe('2026-02-02');
    expect(Object.values(saved.states).filter((s) => s.status !== 'new').length).toBe(summary.introduced.length);
    expect((await store.listSessions('p1'))[0]).toMatchObject({ mode: 'daily', answered: 100, correct: 100 });
  });

  it('only asks multiple choice while free answers are switched off', async () => {
    const { clock, deps } = setup();
    for (let day = 0; day < 4; day++) {
      clock.set(Date.UTC(2026, 1, 2 + day, 15));
      const play = await PlayController.start(profile, deps);
      for (let q = play.question(); q; q = play.question()) {
        expect(q.format).toBe('choice');
        clock.advance(6000);
        await play.answer(q.item.answer, 1500);
      }
      await play.finish();
    }
  });

  it('saves item progress after every answer, but leaving early does not finish the day', async () => {
    const { clock, store, deps } = setup();
    const play = await PlayController.start(profile, deps);
    const q = play.question()!;
    clock.advance(5000);
    await play.answer('0', 3000);
    // Before finishing: the answer is already stored.
    expect((await store.load('p1', 'multiplication'))!.states[q.item.id]).toMatchObject({ seen: 1, confusions: { '0': 1 } });
    expect(await store.countAttempts('p1')).toBe(1);
    const summary = await play.finish();
    expect(summary.completed).toBe(false);
    const { meta } = await loadProgress(profile, deps);
    expect(meta.lastSessionDay).toBeNull();
  });

  it('finishes the day if the app was closed right after the last answer', async () => {
    const { clock, store, deps } = setup();
    const play = await PlayController.start(profile, deps);
    for (let q = play.question(); q; q = play.question()) {
      clock.advance(6000);
      await play.answer(q.item.answer, 2000);
    }
    // The app is closed here: finish() never runs.
    expect((await store.load('p1', 'multiplication'))!.meta.lastSessionDay).toBeNull();
    clock.advance(60_000);
    const again = await PlayController.start(profile, deps);
    expect(again.question()).toBeNull();
    const summary = await again.finish();
    expect(summary.answered).toBe(0);
    const { meta } = await loadProgress(profile, deps);
    expect(meta.lastSessionDay).toBe('2026-02-02');
    expect(meta.sessionsCompleted).toBe(1);
  });

  it('keeps the end-of-session meta when the child leaves while an answer is being saved', async () => {
    const { clock, deps } = setup();
    const play = await PlayController.start(profile, deps);
    const q = play.question()!;
    clock.advance(5000);
    const answering = play.answer(q.item.answer, 2000);
    const summary = await play.finish();
    await answering;
    const { meta } = await loadProgress(profile, deps);
    expect(summary.meta.accuracyEma).toBe(1);
    expect(meta.accuracyEma).toBe(1);
  });

  it('offers short, optional extra practice without new facts', async () => {
    const { clock, deps } = setup();
    await playAll(await PlayController.start(profile, deps), clock);
    const extra = await PlayController.start(profile, deps, 'extra');
    const summary = await playAll(extra, clock);
    expect(summary.mode).toBe('extra');
    expect(summary.introduced).toEqual([]);
    expect(summary.answered).toBe((EXTRA_PRACTICE_MINUTES * 60) / 6);
  });

  it('runs a focus session on one table and remembers which table', async () => {
    const { clock, store, deps } = setup();
    const seven = deps.pack.focusSets!.find((f) => f.id === 't7')!;
    const play = await PlayController.start(profile, deps, 'focus', seven);
    const summary = await playAll(play, clock);
    expect(summary.mode).toBe('focus');
    expect(summary.introduced.length).toBeGreaterThan(0);
    for (const id of summary.introduced) expect(seven.itemIds).toContain(id);
    const [record] = await store.listSessions(profile.id);
    expect(record).toMatchObject({ mode: 'focus', focusId: 't7' });
    const { meta } = await loadProgress(profile, deps);
    expect(meta.lastSessionDay).toBeNull();
    await expect(PlayController.start(profile, deps, 'focus')).rejects.toThrow();
  });

  it('ignores stored items that are not in the released pack', async () => {
    const { store, deps } = setup();
    await store.save({
      profileId: 'p1',
      packId: 'multiplication',
      packVersion: 1,
      states: { '7x8': { ...emptyState('7x8'), status: 'fluent' }, '2x3': { ...emptyState('wrong-key'), status: 'learning' } },
      meta: { pacingGap: 8, unlockedUnitIds: ['u10'], accuracyEma: null, sessionsCompleted: 0, lastSessionDay: null },
      updatedAt: 0,
    });
    const { states } = await loadProgress(profile, deps);
    expect(states['7x8']).toBeUndefined();
    expect(states['2x3']).toMatchObject({ itemId: '2x3', status: 'learning' });
  });
});

describe('garden helpers', () => {
  it('maps status to growth stages', () => {
    expect(stageFor(undefined, false)).toBe('locked');
    expect(stageFor(emptyState('x'), true)).toBe('soil');
    expect(stageFor({ ...emptyState('x'), status: 'learning', box: 0 }, true)).toBe('seed');
    expect(stageFor({ ...emptyState('x'), status: 'learning', box: 2 }, true)).toBe('sprout');
    expect(stageFor({ ...emptyState('x'), status: 'fluent' }, true)).toBe('bush');
    expect(stageFor({ ...emptyState('x'), status: 'automatic' }, true)).toBe('tree');
  });

  it('knows which whole tables the child has (they become sunflowers)', () => {
    const pack = createMultiplicationPack();
    const states: Record<string, ReturnType<typeof emptyState>> = {};
    for (let n = 1; n <= 10; n++) {
      states[`10x${n}`] = { ...emptyState(`10x${n}`), status: 'fluent' };
      states[`${n}x10`] = { ...emptyState(`${n}x10`), status: n === 3 ? 'automatic' : 'fluent' };
    }
    expect([...knownTables(pack, states)]).toEqual([10]);
    states['10x2'] = { ...emptyState('10x2'), status: 'learning' };
    expect(knownTables(pack, states).size).toBe(0);
  });

  it('writes Swedish genitive', () => {
    expect(genitive('Alva')).toBe('Alvas');
    expect(genitive('Lars')).toBe('Lars');
    expect(genitive('Max')).toBe('Max');
  });

  it('keeps each term of a way of thinking on one line', () => {
    expect(keepTerms('18 + 6 = 18 + 2 + 4 = 20 + 4 = 24.')).toBe('18\u00a0+\u00a06 = 18\u00a0+\u00a02\u00a0+\u00a04 = 20\u00a0+\u00a04 = 24.');
    expect(keepTerms('52 − 6 = 52 − 2 − 4. 7 × 6 – nära!')).toBe('52\u00a0−\u00a06 = 52\u00a0−\u00a02\u00a0−\u00a04. 7\u00a0×\u00a06 – nära!');
  });
});

import { savePlacement } from '../../src/shell/play';

describe('saving a placement check', () => {
  it('stores fluent facts, the answers and a session record', async () => {
    const { store, deps } = setup();
    const full: GameDeps = { ...deps, pack: createMultiplicationPack() };
    const result = { passedUnitIds: ['u2'], fluentUnitIds: ['u2'], stoppedAt: 'u10', answers: [{ itemId: '2x3', unitId: 'u2', given: '6', correct: true, rtMs: 1800 }] };
    await savePlacement(profile, full, result, Date.UTC(2026, 1, 2, 15));
    const { states, meta } = await loadProgress(profile, full);
    expect(Object.values(states).filter((s) => s.status === 'fluent')).toHaveLength(19);
    expect(meta.unlockedUnitIds).toEqual(['u2', 'u10']);
    expect(await store.countAttempts('p1')).toBe(1);
    expect((await store.listSessions('p1'))[0]).toMatchObject({ mode: 'placement', answered: 1, correct: 1 });
  });
});
