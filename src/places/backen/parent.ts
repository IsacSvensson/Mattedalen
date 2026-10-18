import { atLeast, diffDays, isStruggling, systemClock, type Engine, type ItemId, type ItemState } from '../../engine';
import {
  CHECK_CATEGORIES,
  EQUALITIES,
  equalityId,
  formatEquality,
  formatFact,
  isEqualityId,
  parseFactId,
  PLUS_FOR_MINUS_DAYS,
  PLUS_FOR_MINUS_FACTS,
  plusForMinus,
} from '../../content/addition';
import type { Profile, SessionRecord } from '../../storage';
import type { AppContext } from '../../shell/app';
import { checkResultsView } from '../../shell/components/checkResults';
import { heatmapView } from '../../shell/components/heatmap';
import { icon } from '../../shell/components/icons';
import { h } from '../../shell/dom';
import { engineFor, loadProgress } from '../../shell/play';
import { factStats, factStatsText, formatDay, knownOf, partNow, STATUS_TEXT, topConfusions, type FactStats, bestTimes, slowButRight } from '../../shell/stats';
import { limitedList } from '../../shell/components/limitedList';
import type { PlaceSummary } from '../../shell/place';
import { partProgress } from './logic';
import { brookDeps, pack } from './pack';
import { showBrook } from './screens/brook';
import { runBrookPlacement } from './screens/placement';
import { wayFor } from '../../shell/words';

/** What the brook covers, for grown-ups. */
export const BROOK_ABOUT = 'Addition och subtraktion inom 20, och likhetstecknet.';

/** The day a grown-up last read about plus for minus on Bäcken's page; "Att göra" asks again two weeks later if it is still there. */
const plusForMinusSeenKey = (profileId: string) => `plusForMinusSeen:${profileId}`;

type PlusForMinus = { itemId: ItemId; text: string }[];

/** The minus facts the child has answered with the sum lately, when they are enough to be the pattern (docs/PLAN-MINUSTECKNET.md); otherwise none. */
async function plusForMinusNow(ctx: AppContext, profile: Profile): Promise<PlusForMinus> {
  const since = systemClock.now() - PLUS_FOR_MINUS_DAYS * 86_400_000;
  const found = plusForMinus(await ctx.store.listAttempts(profile.id, { packId: pack.id, since }));
  return found.length >= PLUS_FOR_MINUS_FACTS ? found : [];
}

/**
 * Bäcken's page in "För vuxna": the state (how much of each part sits, plus
 * and minus apart, and the scale), what is hard right now and the mix-ups, the
 * brook's check, the addition table as a heat map (folded), and the start check.
 */
export async function brookParentPage(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
  const deps = brookDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const [sessionsAll, attempts, summaries] = await Promise.all([
    ctx.store.listSessions(profile.id),
    ctx.store.listAttempts(profile.id, { packId: pack.id }),
    ctx.store.listDaySummaries(profile.id),
  ]);
  const sessions = sessionsAll.filter((s) => s.packId === pack.id);
  const stats = factStats(
    attempts,
    summaries.filter((s) => s.packId === pack.id),
  );
  const counts = engine.statusCounts(states);
  const unlocked = new Set(engine.unlockedUnits(states, meta));
  const lastPlayed = sessions.length ? sessions[sessions.length - 1]!.day : null;
  const parts = partProgress(pack, states, unlocked);
  const minus = await plusForMinusNow(ctx, profile);
  if (minus.length) await ctx.store.setSetting(plusForMinusSeenKey(profile.id), systemClock.today());

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-brook-heading' },
    h('h2', { id: 'place-brook-heading', class: 'place-heading' }, icon('steps'), 'Bäcken'),
    h('p', { class: 'muted place-about' }, BROOK_ABOUT),
    h('h3', null, 'Läget'),
    h(
      'ul',
      { class: 'status-summary' },
      (['automatic', 'fluent', 'learning', 'new'] as const).map((s) => h('li', { class: `status-${s}` }, h('strong', null, counts[s]), ` ${STATUS_TEXT[s]}`)),
    ),
    h(
      'p',
      { class: 'muted' },
      `${meta.sessionsCompleted} fullständiga pass`,
      lastPlayed ? ` · senast ${formatDay(lastPlayed)}` : '',
      ` · ${unlocked.size} av ${pack.units.length} delar öppna`,
    ),
    h('h4', null, 'Delarna'),
    h(
      'ul',
      { class: 'brook-parts parent' },
      parts.map((p) =>
        h(
          'li',
          { class: p.open ? undefined : 'closed' },
          h('span', { class: 'part-name' }, p.title),
          h('span', { class: 'part-count' }, p.open ? partCount(p.id, states, p.understanding) : 'inte öppen än'),
        ),
      ),
    ),
    h('h4', null, 'Vågen'),
    scaleSummary(states),
    h('h3', null, 'Svåra just nu'),
    hardList(states, engine, minus, profile.name),
    h('h3', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
    h('h3', null, 'Bäckens koll'),
    checkResults(sessionsAll.filter((x) => x.packId === pack.id && x.mode === 'check')),
    h(
      'details',
      { class: 'all-facts' },
      h('summary', null, 'Alla fakta (värmekarta)'),
      h('h4', null, 'Additionstabellen'),
      h('p', { class: 'muted' }, 'Rad plus kolumn, 0–10. Minus finns i delarna ovan.'),
      additionHeatmap(states, stats),
    ),
    h('h3', null, 'Startkoll'),
    h('p', { class: 'muted' }, 'En kort koll av vad barnet redan kan. Den kan bara flytta fram barnet, aldrig bakåt.'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => void runBrookPlacement(ctx, profile, () => showBrook(ctx, profile)) }, 'Gör om startkollen vid bäcken'),
  );
}

/** Bäckens koll, newest first (see `checkResultsView`). */
function checkResults(checks: SessionRecord[]): HTMLElement {
  return checkResultsView(
    checks,
    CHECK_CATEGORIES,
    'Samma sorts uppgifter ungefär var sjunde speldag, utan anpassning, så att det går att jämföra över tid. Likhetstecknet prövas i former barnet inte har övat.',
    'Ingen koll än. Den första kommer andra dagen barnet är vid bäcken.',
  );
}

const sits = (s: ItemState | undefined) => s !== undefined && atLeast(s.status, 'fluent');

/** "plus 10 av 12 · minus 6 av 12" for a part about facts; "8 av 24" for the scale. */
function partCount(unitId: string, states: Record<ItemId, ItemState>, understanding: boolean): string {
  const ids = pack.units.find((u) => u.id === unitId)?.itemIds ?? [];
  const known = (list: ItemId[]) => list.filter((id) => sits(states[id])).length;
  if (understanding) return `${known(ids)} av ${ids.length} sitter`;
  const plus = ids.filter((id) => id.includes('+'));
  const minus = ids.filter((id) => id.includes('-'));
  return `plus ${known(plus)} av ${plus.length} · minus ${known(minus)} av ${minus.length}`;
}

function additionHeatmap(states: Record<ItemId, ItemState>, stats: Map<ItemId, FactStats>): HTMLElement {
  const terms = Array.from({ length: 11 }, (_, i) => i);
  return heatmapView({
    corner: '+',
    rows: terms,
    cols: terms,
    label: 'Värmekarta över additionstabellen',
    cell: (a, b) => {
      const id = `${a}+${b}`;
      return { state: states[id], text: describeFact(id, states[id], stats.get(id)) };
    },
  });
}

function describeFact(id: ItemId, s: ItemState | undefined, st: FactStats | undefined): string {
  const f = parseFactId(id);
  const parts = [`${formatFact(f.op, f.x, f.y)} = ${f.answer}: ${STATUS_TEXT[s?.status ?? 'new']}`];
  parts.push(...factStatsText(st));
  const worst = Object.entries(s?.confusions ?? {}).sort((x, y) => y[1] - x[1])[0];
  if (worst) parts.push(`vanligaste felsvar ${worst[0]}`);
  return parts.join(' · ');
}

const label = (id: ItemId) => {
  if (isEqualityId(id)) {
    const e = EQUALITIES.find((x) => equalityId(x) === id);
    return e ? formatEquality(e).replace(/__/g, '?') : id;
  }
  const f = parseFactId(id);
  return formatFact(f.op, f.x, f.y);
};

/** Facts the child finds hard right now, easiest first, with the way the game helps. */
function hardFacts(states: Record<ItemId, ItemState>, engine: Engine): { id: ItemId; text: string; strategy: string | undefined }[] {
  const today = systemClock.today();
  return Object.values(states)
    .filter((s) => !isEqualityId(s.itemId) && isStruggling(s, today, engine.config.support))
    .map((s) => {
      const f = parseFactId(s.itemId);
      return { id: s.itemId, text: `${formatFact(f.op, f.x, f.y)} = ${f.answer}`, strategy: engine.item(s.itemId).hints.find((x) => x.kind === 'strategy')?.text, size: f.answer };
    })
    .sort((x, y) => x.size - y.size || x.text.localeCompare(y.text));
}

/**
 * Facts the child finds hard right now, with the way the game helps, so
 * grown-ups can use the same idea. At most five, with "Visa alla". When the
 * child reads minus as plus, that is said first, and the facts it explains are
 * left out of the list.
 */
function hardList(states: Record<ItemId, ItemState>, engine: Engine, minus: PlusForMinus, name: string): HTMLElement {
  const explained = new Set(minus.map((m) => m.itemId));
  const hard = hardFacts(states, engine).filter((x) => !explained.has(x.id));
  const note = minus.length ? plusForMinusNote(minus, name) : null;
  if (hard.length === 0) return h('div', null, note, h('p', { class: 'muted' }, note ? 'Inga andra just nu.' : 'Inga just nu.'));
  return h(
    'div',
    null,
    note,
    h('p', { class: 'muted' }, 'Fel på flera dagar, eller länge utan att fastna. De här tas i steg från det barnet redan kan (räknestigen), med tallinjen.'),
    limitedList(
      'ul',
      'hard-list',
      hard.map(({ text, strategy }) => h('li', null, h('strong', null, text), strategy ? h('span', { class: 'muted hard-way' }, wayFor(text, strategy)) : null)),
    ),
  );
}

/** Plus read for minus, in words and with a way to show what minus means. */
function plusForMinusNote(minus: PlusForMinus, name: string): HTMLElement {
  const [a, b] = minus;
  return h(
    'div',
    { class: 'pattern-note' },
    h('p', null, h('strong', null, `${name} svarar ofta summan när det står minus`), `: ${a!.text} och ${b!.text}. Minustecknet kan vara nytt.`),
    h('p', null, 'Visa med fingrar eller saker att minus betyder att ta bort. 4 − 1: håll upp fyra fingrar och vik ner ett. Kvar är 3.'),
  );
}

/** Bäcken in the overview of "För vuxna": what the child is on, what is hardest, and how much sits. */
export async function brookParentSummary(ctx: AppContext, profile: Profile): Promise<PlaceSummary> {
  const deps = brookDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const minus = await plusForMinusNow(ctx, profile);
  const explained = new Set(minus.map((m) => m.itemId));
  const hardest = hardFacts(states, engine).find((x) => !explained.has(x.id));
  const seen = await ctx.store.getSetting<string>(plusForMinusSeenKey(profile.id));
  const todo: PlaceSummary['todo'] = [];
  if (minus.length && (seen === undefined || diffDays(seen, systemClock.today()) >= PLUS_FOR_MINUS_DAYS))
    todo.push({ text: `${profile.name} verkar räkna plus när det står minus (${minus[0]!.text}).`, seePlace: 'Visa Bäcken' });
  return {
    now: partNow(pack, states, new Set(engine.unlockedUnits(states, meta))),
    hardest: hardest ? [hardest.text] : null,
    ...knownOf(pack, states),
    slow: slowButRight(engine, states),
    bestTimes: bestTimes(states),
    todo,
  };
}

function confusionList(states: Record<ItemId, ItemState>): HTMLElement {
  const list = topConfusions(states, 8, label);
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  const said = (given: string) => (given === 'ja' ? 'Ja' : given === 'nej' ? 'Nej' : given);
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) =>
      h('li', null, h('strong', null, c.fact), `: svarade ${said(c.given)} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`)),
    ),
  );
}

/** The scale by kind of task: a blank to fill in, or "stämmer det?". */
function scaleSummary(states: Record<ItemId, ItemState>): HTMLElement {
  const kinds = [
    { kind: 'balance', text: 'Vad ska stå i rutan?' },
    { kind: 'truefalse', text: 'Stämmer det?' },
  ] as const;
  return h(
    'ul',
    { class: 'brook-parts parent' },
    kinds.map(({ kind, text }) => {
      const ids = EQUALITIES.filter((e) => e.kind === kind).map(equalityId);
      const known = ids.filter((id) => sits(states[id])).length;
      return h('li', null, h('span', { class: 'part-name' }, text), h('span', { class: 'part-count' }, `${known} av ${ids.length} sitter`));
    }),
  );
}
