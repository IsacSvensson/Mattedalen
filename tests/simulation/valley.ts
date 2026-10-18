import { createEngine, diffDays, isStruggling, knownPath, makeConfig, ManualClock, seededRng, type Engine, type ItemId, type ItemState, type LearnerMeta, type Rng, type StatusConfig } from '../../src/engine';
import { createAdditionPack, type MinusAfter } from '../../src/content/addition';
import { createHundredPack } from '../../src/content/hundred';
import { createMultiplicationPack, isDivisionId, isFactId, parseDivisionId, parseFactId } from '../../src/content/multiplication';
import { planDay, restedYesterday, type DayPlan } from '../../src/shell/dayPlan';
import { partSits } from '../../src/shell/parts';
import { bestTimes, QUICK_FACTS, slowButRight, slowFacts } from '../../src/shell/stats';
import { gardenOpens } from '../../src/places/tradgarden/opening';
import { heldTables, tablesWaiting, WAIT_PLAY_DAYS } from '../../src/places/tradgarden/waits';
import { pathOpens, pathWaiting } from '../../src/places/stigen/opening';
import { SimulatedLearner, type LearnerProfile } from './learner';

/**
 * A simulated child in the whole valley (docs/PLAN-HUNDRA.md): the brook from
 * the start, the garden when doubles sit, Stigen when its rule says so. Each
 * day the day's plan picks at most two places and shares the time, as the
 * valley does, and the garden's tables wait for Stigen (`waits`). Each place
 * has its own memory model: what is learnt at one place does not help another
 * (pessimistic: 40 + 30 does build on 4 + 3).
 */
export interface ValleyOptions {
  profile: LearnerProfile;
  seed: number;
  weeks: number;
  /** Stigen is in the valley. */
  path: boolean;
  /**
   * How the garden's tables wait for Stigen: as in the app (`capped`, at most
   * `WAIT_PLAY_DAYS` play days), until their part sits however long that takes (`hard`,
   * the first plan), or not at all.
   */
  waits?: 'capped' | 'hard' | 'none';
  /** The brook's parts Stigen opens after (the app's `PATH_OPENS_AFTER` by default). */
  pathAfter?: readonly string[];
  minutes?: number;
  /** Other rules for the steps (docs/PLAN-GRANSKNING.md, S2), on top of each pack's own. */
  status?: Partial<StatusConfig>;
  /** `one`: every garden fact has only the table's own way, as before S3 (docs/PLAN-RAKNESTIG.md). */
  ways?: 'one' | 'all';
  /** What the brook's minus facts wait for (docs/PLAN-PLUSFORST.md); the app's by default. */
  minusAfter?: MinusAfter;
}

const BROOK_DIFFICULTY: Record<string, number> = {
  noll: 0, ettmer: 0, tio: 0.1, sma: 0.2, tiokamrater: 0.3, dubblor: 0.3, vagen: 0.3, inom10: 0.5, naradubblor: 0.6, overtio: 0.9,
};
const PATH_DIFFICULTY: Record<string, number> = {
  tiotal: 0.1, tiental: 0.2, hopptio: 0.3, ental: 0.3, tilltio: 0.4, dubbla: 0.6, overtio: 0.8, tvasiffr: 0.9, tvasiffrminus: 0.9,
};
const BROOK_KNOWN_BEFORE = ['noll', 'ettmer', 'sma', 'tio'];

const hard = (n: number) => (n <= 2 || n === 5 || n === 10 ? 0 : n <= 4 ? 0.4 : 0.9);
function gardenDifficulty(id: ItemId): number {
  if (isFactId(id)) {
    const { a, b } = parseFactId(id);
    return Math.max(hard(a), hard(b));
  }
  if (isDivisionId(id)) {
    const { divisor, quotient } = parseDivisionId(id);
    return Math.max(hard(divisor), hard(quotient));
  }
  return 0.2;
}

interface Place {
  id: 'addition' | 'hundred' | 'multiplication';
  engine: Engine;
  learner: SimulatedLearner;
  states: Record<ItemId, ItemState>;
  meta: LearnerMeta;
  openDay: number | null;
}

export interface ValleyResult {
  /** Day each part was first practised (a new item introduced), by place and part. */
  firstDay: Record<string, number>;
  openDay: Record<string, number | null>;
  /** Share of the garden's multiplications that sit, at the given week. */
  timesSit: (week: number) => number;
  /** Day a part first sat (80 % fluent), by place and part. */
  sitDay: Record<string, number>;
  /** Garden tables that started while their part on Stigen did not sit yet: let go by the cap. */
  byCap: string[];
  answered: number;
  correct: number;
  /** The garden's multiplications at the end of each week (S2). */
  weekly: WeekState[];
  /** The child's own speed: median time of the first two weeks' correct answers on what the child knew before (the brook's easiest parts). */
  knownRtMs: number | null;
  /** The brook at the end of each week (docs/PLAN-PLUSFORST.md). */
  brookWeekly: BrookWeek[];
}

/** The brook at the end of a week: shares of its plus and minus facts that sit, and the minus facts waiting for their plus. */
export interface BrookWeek {
  plus: number;
  minus: number;
  /** New minus facts in open parts whose plus facts do not sit yet. */
  waiting: number;
}

/** The garden's multiplications at the end of a week: shares of all of them, and of the ones that sit. */
export interface WeekState {
  /** At least fluent (a bush). */
  sit: number;
  automatic: number;
  /** Of the bushes and trees: the child would not recall it (the model's P(recall) under ½), only work it out. */
  notRecalled: number;
  /** The same for the trees alone. */
  treesNotRecalled: number;
  /** Introduced four weeks ago or more and still a sprout, in every open place. */
  stuck: number;
  /** Median time of the week's correct answers in the garden, ms. */
  rtMs: number | null;
  /** The garden's hard facts at the week's end, and of them those without a way the child knows (no räknestig). */
  hard: number;
  hardNoWay: number;
  /** Of those, the ones with no way at all (×1, ×2, ×10, and divisions without a path). */
  hardNoPath: number;
  /** Räknestigar in the garden during the week. */
  derives: number;
  /** Facts more time would help with, over the open places (`slowFacts`), and the child's tenth quickest fact. */
  slowFacts: number;
  quickMs: number | null;
}

const DAY_MS = 86_400_000;
const share = (n: number, of: number) => (of ? n / of : 0);

export function simulateValley(o: ValleyOptions): ValleyResult {
  const clock = new ManualClock(Date.UTC(2026, 0, 5, 15));
  const rng: Rng = seededRng(o.seed + 3000);
  const make = (id: Place['id'], pack: ReturnType<typeof createAdditionPack>, difficulty: (id: ItemId) => number, k: number): Place => {
    const config = o.status ? makeConfig(pack.config ?? {}, { status: o.status }) : undefined;
    const engine = createEngine({ pack, config, clock, rng: seededRng(o.seed + k) });
    const learner = new SimulatedLearner(o.profile, seededRng(o.seed + 100 + k), difficulty, (i) => engine.item(i).pairId, (i) => engine.item(i).derivedFrom);
    return { id, engine, learner, states: engine.initialStates(), meta: engine.initialMeta(), openDay: null };
  };
  const brookPack = createAdditionPack({ minusAfter: o.minusAfter });
  const pathPack = createHundredPack();
  const gardenPack = createMultiplicationPack({ division: true });
  if (o.ways === 'one') for (const item of gardenPack.items) delete item.paths;
  const brook = make('addition', brookPack, (i) => BROOK_DIFFICULTY[brookPack.units.find((u) => u.itemIds.includes(i))!.id] ?? 0.5, 1);
  const unitOfPath = new Map(pathPack.units.flatMap((u) => u.itemIds.map((i) => [i, u.id])));
  const path = make('hundred', pathPack, (i) => PATH_DIFFICULTY[unitOfPath.get(i)!] ?? 0.5, 2);
  const garden = make('multiplication', gardenPack, gardenDifficulty, 3);
  brook.learner.prime(brookPack.items.filter((i) => BROOK_KNOWN_BEFORE.includes(i.unitId)).map((i) => i.id), 60);
  brook.openDay = 0;
  const places = o.path ? [garden, brook, path] : [garden, brook];

  const firstDay: Record<string, number> = {};
  const byCap: string[] = [];
  const sitDay: Record<string, number> = {};
  const timesHistory: number[] = [];
  const weekly: WeekState[] = [];
  const brookWeekly: BrookWeek[] = [];
  const plusIds = brookPack.items.filter((i) => /^\d+\+\d+$/.test(i.id));
  const minusIds = brookPack.items.filter((i) => /^\d+-\d+$/.test(i.id));
  let weekRts: number[] = [];
  let weekDerives = 0;
  const knownRts: number[] = [];
  const timesIds = gardenPack.items.filter((i) => isFactId(i.id)).map((i) => i.id);
  let last: DayPlan | undefined;
  let ready: Record<string, string> = {};
  const played: string[] = [];
  let answered = 0;
  let correct = 0;
  const unitOf = (p: Place) => new Map(p.engine.pack.units.flatMap((u) => u.itemIds.map((i) => [i, u.id])));
  const units = new Map(places.map((p) => [p.id, unitOf(p)]));

  for (let day = 0; day < o.weeks * 7; day++) {
    clock.set(Date.UTC(2026, 0, 5, 15) + day * DAY_MS);
    const today = clock.today();
    if (garden.openDay === null && gardenOpens({ gardenStates: garden.states, brook: { pack: brookPack, states: brook.states }, openedByAdult: false })) garden.openDay = day;
    if (o.path && path.openDay === null && pathOpens({ pathStates: path.states, brook: { pack: brookPack, states: brook.states }, openedByAdult: false, after: o.pathAfter }))
      path.openDay = day;
    const open = places.filter((p) => p.openDay !== null);
    const loads = open.map((p) => ({ id: p.id, due: p.engine.dueCount(p.states) }));
    const plan = planDay(today, o.minutes ?? 12, loads, restedYesterday(last, today, loads.map((l) => l.id)));
    last = plan;
    // A day off still ends its week: the week's state is taken on it too.
    const plays = rng.next() <= 6 / 7;
    for (const p of plays ? open : []) {
      const minutes = plan.minutes[p.id];
      if (minutes === undefined) continue;
      const tables = () => {
        // As in the app: nothing waits while Stigen is closed.
        if (o.waits === 'none' || path.openDay === null) return [];
        const waiting = tablesWaiting(pathPack, path.states, { pack: gardenPack, states: garden.states });
        const could = new Set(garden.engine.unlockedUnits(garden.states, garden.meta));
        const out = heldTables(waiting, could, ready, today, played, o.waits === 'hard' ? Infinity : WAIT_PLAY_DAYS);
        ready = out.ready;
        return out.held;
      };
      const held = !o.path ? [] : p === garden ? tables() : p === path ? pathWaiting(brookPack, brook.states) : [];
      const session = p.engine.startSession({ states: p.states, meta: p.meta, heldUnitIds: held, durationMs: minutes * 60_000 });
      for (let q = session.next(); q; q = session.next()) {
        const { given, rtMs } = p.learner.answer(q, clock.now());
        clock.advance(rtMs);
        const fb = session.submit(given, rtMs);
        clock.advance(fb.correct ? 2500 : 8000);
        if (p === garden && fb.correct && q.kind !== 'new') weekRts.push(rtMs);
        if (p === garden && q.kind === 'derive') weekDerives++;
        if (p === brook && fb.correct && q.kind !== 'new' && day < 14 && BROOK_KNOWN_BEFORE.includes(q.item.unitId)) knownRts.push(rtMs);
        answered++;
        if (fb.correct) correct++;
      }
      const summary = session.summary();
      p.states = session.stateRecord();
      p.meta = summary.meta;
      const stillWaiting = p === garden && o.path && path.openDay !== null && o.waits !== 'none' ? tablesWaiting(pathPack, path.states, { pack: gardenPack, states: garden.states }) : [];
      for (const id of summary.introduced) {
        const unit = units.get(p.id)!.get(id)!;
        const key = `${p.id}:${unit}`;
        if (firstDay[key] === undefined && stillWaiting.includes(unit)) byCap.push(unit);
        firstDay[key] ??= day;
      }
      for (const u of p.engine.pack.units) if (sitDay[`${p.id}:${u.id}`] === undefined && partSits(p.engine.pack, p.states, u.id)) sitDay[`${p.id}:${u.id}`] = day;
    }
    // As in the app: a day counts once its sessions are saved.
    if (plays && open.some((p) => plan.minutes[p.id] !== undefined)) played.push(today);
    if (day % 7 === 6) {
      const sits = timesIds.filter((i) => ['fluent', 'automatic'].includes(garden.states[i]!.status));
      const trees = sits.filter((i) => garden.states[i]!.status === 'automatic');
      timesHistory.push(sits.length / timesIds.length);
      let stuck = 0;
      let introduced = 0;
      for (const p of open)
        for (const s of Object.values(p.states)) {
          if (s.introducedDay === null) continue;
          introduced++;
          if (s.status === 'learning' && diffDays(s.introducedDay, today) >= 28) stuck++;
        }
      weekRts.sort((a, b) => a - b);
      const hard = Object.values(garden.states).filter((st) => (isFactId(st.itemId) || isDivisionId(st.itemId)) && isStruggling(st, today, garden.engine.config.support));
      weekly.push({
        sit: sits.length / timesIds.length,
        automatic: trees.length / timesIds.length,
        notRecalled: sits.length ? sits.filter((i) => garden.learner.recallProbability(i) < 0.5).length / sits.length : 0,
        treesNotRecalled: share(trees.filter((i) => garden.learner.recallProbability(i) < 0.5).length, trees.length),
        stuck: introduced ? stuck / introduced : 0,
        rtMs: weekRts.length ? weekRts[Math.floor(weekRts.length / 2)]! : null,
        hard: hard.length,
        hardNoWay: hard.filter((st) => !knownPath(garden.engine.item(st.itemId), (id) => garden.states[id])).length,
        hardNoPath: hard.filter((st) => {
          const item = garden.engine.item(st.itemId);
          return item.derivedFrom.length === 0 && !item.paths?.length;
        }).length,
        derives: weekDerives,
        slowFacts: slowFacts(open.map((p) => ({ slow: slowButRight(p.engine, p.states), bestTimes: bestTimes(p.states) }))),
        quickMs: open.flatMap((p) => bestTimes(p.states)).sort((a, b) => a - b)[QUICK_FACTS - 1] ?? null,
      });
      weekRts = [];
      weekDerives = 0;
      const sitsAt = (st: ItemState | undefined) => st !== undefined && (st.status === 'fluent' || st.status === 'automatic');
      const openParts = new Set(brook.engine.unlockedUnits(brook.states, brook.meta));
      brookWeekly.push({
        plus: share(plusIds.filter((i) => sitsAt(brook.states[i.id])).length, plusIds.length),
        minus: share(minusIds.filter((i) => sitsAt(brook.states[i.id])).length, minusIds.length),
        waiting: minusIds.filter((i) => openParts.has(i.unitId) && brook.states[i.id]!.status === 'new' && i.requires?.some((r) => !sitsAt(brook.states[r]))).length,
      });
    }
  }
  return {
    firstDay,
    sitDay,
    byCap,
    openDay: Object.fromEntries(places.map((p) => [p.id, p.openDay])),
    timesSit: (week) => timesHistory[Math.min(week, timesHistory.length) - 1] ?? 0,
    answered,
    correct,
    weekly,
    knownRtMs: knownRts.length ? knownRts.sort((a, b) => a - b)[Math.floor(knownRts.length / 2)]! : null,
    brookWeekly,
  };
}
