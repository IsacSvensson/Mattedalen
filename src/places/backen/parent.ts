import { atLeast, isStruggling, systemClock, type Engine, type ItemId, type ItemState } from '../../engine';
import { CHECK_CATEGORIES, EQUALITIES, equalityId, formatEquality, formatFact, isEqualityId, parseFactId } from '../../content/addition';
import type { Profile, SessionRecord } from '../../storage';
import type { AppContext } from '../../shell/app';
import { checkResultsView } from '../../shell/components/checkResults';
import { heatmapView } from '../../shell/components/heatmap';
import { icon } from '../../shell/components/icons';
import { h } from '../../shell/dom';
import { engineFor, loadProgress } from '../../shell/play';
import { factStats, formatDay, STATUS_TEXT, topConfusions, type FactStats } from '../../shell/stats';
import { partProgress } from './logic';
import { brookDeps, pack } from './pack';
import { showBrook } from './screens/brook';
import { runBrookPlacement } from './screens/placement';

/**
 * Bäcken's part of the parent view: the addition table as a heat map, how much
 * of each part sits (plus and minus apart), what is hard right now, the most
 * common mix-ups, the scale (Vågen) by kind of task, and the start check.
 */
export async function brookParentSection(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
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

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-brook-heading' },
    h('h3', { id: 'place-brook-heading', class: 'place-heading' }, icon('steps'), 'Bäcken'),
    h('p', { class: 'muted place-about' }, 'Addition och subtraktion inom 20, och likhetstecknet.'),
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
    h('h4', null, 'Additionstabellen'),
    h('p', { class: 'muted' }, 'Rad plus kolumn, 0–10. Minus finns i delarna nedan.'),
    additionHeatmap(states, stats),
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
    h('h4', null, 'Svåra just nu'),
    hardList(states, engine),
    h('h4', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
    h('h4', null, 'Vågen'),
    scaleSummary(states),
    h('h4', null, 'Bäckens koll'),
    checkResults(sessionsAll.filter((x) => x.packId === pack.id && x.mode === 'check')),
    h('h4', null, 'Startkoll'),
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
  if (st?.attempts) {
    parts.push(`${st.attempts} försök, ${Math.round((st.correct / st.attempts) * 100)} % rätt`);
    if (st.meanRtMs) parts.push(`snitt ${(st.meanRtMs / 1000).toFixed(1)} s`);
  }
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

/** Facts the child finds hard right now, with the way the game helps, so grown-ups can use the same idea. */
function hardList(states: Record<ItemId, ItemState>, engine: Engine): HTMLElement {
  const today = systemClock.today();
  const hard = Object.values(states).filter((s) => !isEqualityId(s.itemId) && isStruggling(s, today, engine.config.support));
  if (hard.length === 0) return h('p', { class: 'muted' }, 'Inga just nu.');
  return h(
    'div',
    null,
    h('p', { class: 'muted' }, 'Fel på flera dagar, eller länge utan att fastna. De här tas i steg från det barnet redan kan (räknestigen), med tallinjen.'),
    h(
      'ul',
      { class: 'hard-list' },
      hard.map((s) => {
        const f = parseFactId(s.itemId);
        const strategy = engine.item(s.itemId).hints.find((x) => x.kind === 'strategy')?.text;
        return h('li', null, h('strong', null, `${formatFact(f.op, f.x, f.y)} = ${f.answer}`), strategy ? ` – ${strategy}` : '');
      }),
    ),
  );
}

function confusionList(states: Record<ItemId, ItemState>): HTMLElement {
  const list = topConfusions(states, 8, label);
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  const said = (given: string) => (given === 'ja' ? 'Ja' : given === 'nej' ? 'Nej' : given);
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) =>
      h('li', null, h('strong', null, c.fact), ` – svarade ${said(c.given)} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`)),
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
