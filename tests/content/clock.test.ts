import { describe, expect, it } from 'vitest';
import { createEngine, ManualClock, seededRng } from '../../src/engine';
import {
  allTasks,
  candidates,
  clockNote,
  createClockPack,
  handWords,
  handsNote,
  supportsFor,
  mistakeOf,
  normalizeAnswer,
  parseClock,
  parseTaskId,
  phrase,
  strategyFor,
  taskAnswer,
  taskId,
  TIMES,
  UNIT_DEFS,
} from '../../src/content/clock';
import { AVERAGE, SimulatedLearner, simulate } from '../simulation/learner';

/** Klocktornet's content, steps 0–5 (docs/PLAN-KLOCKAN.md, KL2). */
describe('the words for a time', () => {
  it.each([
    [3, 0, 'tre'],
    [12, 0, 'tolv'],
    [3, 30, 'halv fyra'],
    [12, 30, 'halv ett'],
    [11, 30, 'halv tolv'],
    [3, 15, 'kvart över tre'],
    [12, 15, 'kvart över tolv'],
    [3, 45, 'kvart i fyra'],
    [12, 45, 'kvart i ett'],
    [11, 45, 'kvart i tolv'],
  ])('%i:%i is "%s"', (h, m, words) => {
    expect(phrase({ h, m })).toBe(words);
  });
  it('has no words yet for five minutes at a time (KL5)', () => {
    expect(phrase({ h: 3, m: 25 })).toBeNull();
  });
  it('reads the hour hand alone', () => {
    expect(handWords(3, 'on')).toBe('på 3');
    expect(handWords(3, 'after')).toBe('strax efter 3');
    expect(handWords(3, 'half')).toBe('mitt emellan 3 och 4');
    expect(handWords(12, 'before')).toBe('strax före 1');
  });
});

describe('answers', () => {
  it('take times with a colon, a point or a zero first, words in any case', () => {
    expect(normalizeAnswer('03:30')).toBe('3:30');
    expect(normalizeAnswer('3.30')).toBe('3:30');
    expect(normalizeAnswer(' Halv  Fyra ')).toBe('halv fyra');
    expect(normalizeAnswer('025')).toBe('25');
    expect(parseClock('12:45')).toEqual({ h: 12, m: 45 });
    expect(parseClock('3:75')).toBeNull();
  });
});

describe('the pack', () => {
  const pack = createClockPack();

  it('has unique ids that read back as their tasks', () => {
    const ids = pack.items.map((it) => it.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const task of allTasks()) expect(taskId(parseTaskId(taskId(task)))).toBe(taskId(task));
  });

  it('has the parts of the stair, each with tasks, building only on earlier parts', () => {
    expect(pack.units.map((u) => u.id)).toEqual(['dagen', 'urtavlan', 'timvisaren', 'hel', 'halv', 'kvart', 'femmin']);
    const seen = new Set<string>();
    for (const def of UNIT_DEFS) {
      for (const r of def.requires) expect(seen.has(r), `${def.id} builds on ${r}`).toBe(true);
      seen.add(def.id);
      expect(pack.units.find((u) => u.id === def.id)!.itemIds.length).toBeGreaterThan(0);
    }
    for (const u of pack.units) expect(u.kind).toBe('understanding');
  });

  it('asks every time in its forms: words (not yet for five minutes), digital, set the hands', () => {
    const ids = new Set(pack.items.map((it) => it.id));
    for (const unit of ['hel', 'halv', 'kvart', 'femmin'] as const) {
      for (const t of TIMES[unit]) {
        const key = `${t.h}:${String(t.m).padStart(2, '0')}`;
        expect(ids.has(`kl:dig:${key}`)).toBe(true);
        expect(ids.has(`kl:stall:${key}`)).toBe(true);
        expect(ids.has(`kl:ord:${key}`)).toBe(unit !== 'femmin');
        expect(ids.has(`kl:min:${key}`)).toBe(unit === 'femmin');
      }
    }
    expect(pack.items.find((it) => it.id === 'kl:stall:3:30')!.formats).toEqual(['free']);
    expect(pack.items.find((it) => it.id === 'kl:ord:3:30')!.formats).toEqual(['choice']);
  });

  it('never offers the answer as a wrong answer, and every wrong answer is a known mistake', () => {
    for (const task of allTasks()) {
      const answer = taskAnswer(task);
      const wrong = candidates(task);
      if (!(task.kind === 'read' && task.form === 'stall')) expect(wrong.length, taskId(task)).toBeGreaterThan(0);
      for (const c of wrong) {
        expect(c.value, taskId(task)).not.toBe(answer);
        expect(mistakeOf(task, c.value), `${taskId(task)} ${c.value}`).not.toBeNull();
      }
    }
  });

  it('knows the Swedish trap and the other mistakes', () => {
    const halfPast = parseTaskId('kl:ord:3:30');
    expect(mistakeOf(halfPast, 'halv tre')).toBe('hourName');
    expect(clockNote(halfPast, 'halv tre')).toBe('Halv fyra är halvvägs till fyra. Timvisaren står mitt emellan 3 och 4.');
    const digital = parseTaskId('kl:dig:3:30');
    expect(mistakeOf(digital, '3:06')).toBe('digitAsMinutes');
    expect(mistakeOf(digital, '6:15')).toBe('handsSwapped');
    expect(mistakeOf(digital, '4:30')).toBe('hourName');
    expect(mistakeOf(parseTaskId('kl:ord:3:45'), 'kvart över fyra')).toBe('pastTo');
    expect(mistakeOf(parseTaskId('kl:min:4:25'), '5')).toBe('digitAsMinutes');
    expect(mistakeOf(parseTaskId('tim:3:half'), 'på 3')).toBe('hourOnNumber');
    expect(clockNote(digital, '3:06')).toMatch(/^Minutvisaren visar minuter/);
  });

  it('says why in the right words', () => {
    expect(strategyFor(parseTaskId('kl:ord:3:30'))).toBe('Minutvisaren på 6 är 30 minuter, en halv timme. Timvisaren är halvvägs till 4: halv fyra, 3:30.');
    expect(strategyFor(parseTaskId('kl:dig:4:25'))).toBe('Minutvisaren på 5: räkna 5, 10, 15, 20, 25. Det är 25 minuter över 4: 4:25.');
    for (const it of pack.items) expect(it.hints.find((h) => h.kind === 'strategy')?.text, it.id).toMatch(/\S/);
    for (const it of pack.items) expect(it.hints.find((h) => h.kind === 'strategy')!.text).not.toMatch(/den lilla|den stora/);
  });

  it('a child goes up the stair in order', () => {
    const clock = new ManualClock(Date.UTC(2026, 0, 5, 15));
    const engine = createEngine({ pack, clock, rng: seededRng(3) });
    const learner = new SimulatedLearner(AVERAGE, seededRng(4), () => 0.3, () => undefined, () => []);
    const result = simulate(engine, learner, seededRng(5), { days: 70 }, clock);
    const first = (unit: string) => result.days.find((d) => d.summary.introduced.some((id) => engine.item(id).unitId === unit))?.day ?? Infinity;
    expect(first('urtavlan')).toBe(0);
    expect(first('hel')).toBeLessThan(first('halv'));
    expect(first('halv')).toBeLessThan(first('kvart'));
    expect(first('kvart')).toBeLessThan(first('femmin'));
    expect(first('femmin')).toBeLessThan(70);
  });
});

describe('the hands the child set (KL3)', () => {
  const t = { h: 3, m: 30 };
  it('says which hand is wrong', () => {
    expect(handsNote(t, '3:30')).toBeUndefined();
    expect(handsNote(t, '4:30')).toBe('Minutvisaren står rätt. Timvisaren ska stå mellan 3 och 4.');
    expect(handsNote(t, '3:15')).toBe('Timvisaren står rätt. Minutvisaren ska stå på 6, 30 minuter.');
    expect(handsNote(t, '5:00')).toBe('Minutvisaren ska stå på 6, 30 minuter, och timvisaren mellan 3 och 4.');
    expect(handsNote({ h: 8, m: 0 }, '8:30')).toBe('Timvisaren står rätt. Minutvisaren ska stå på 12, hel timme.');
    expect(handsNote(t, 'halv fyra')).toBeUndefined();
  });
});

describe('the supports on the face', () => {
  it('are taken away one at a time', () => {
    expect(supportsFor(undefined, 'kvart')).toEqual({ minuteRing: true, quarters: true, look: 'plain' });
    expect(supportsFor({ status: 'learning', box: 0 }, 'halv')).toEqual({ minuteRing: true, quarters: false, look: 'plain' });
    expect(supportsFor({ status: 'learning', box: 1 }, 'halv')).toEqual({ minuteRing: false, quarters: false, look: 'plain' });
    expect(supportsFor({ status: 'fluent', box: 2 }, 'halv', 'station')).toEqual({ minuteRing: false, quarters: false, look: 'station' });
    expect(supportsFor({ status: 'fluent', box: 2 }, 'halv', 'ord')).toEqual({ minuteRing: false, quarters: false, look: 'plain' });
  });
});
