import { isStruggling, systemClock, type EngineConfig, type ItemState } from '../../engine';
import { factId, formatFact, MAX_FACTOR, MIN_FACTOR, parseFactId, strategyFor } from '../../content/multiplication';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { plantIcon } from '../../shell/components/plant';
import { h } from '../../shell/dom';
import type { SaveProfile } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { factStats, formatDay, STATUS_TEXT, topConfusions, type FactStats } from '../../shell/stats';
import { gardenDeps, pack } from './pack';
import { showPlacementOffer } from './screens/placement';

/** Trädgården's part of the parent view: what the child knows of the tables, and the start check. */
export async function gardenParentSection(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<HTMLElement> {
  const deps = gardenDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const [sessions, attempts, summaries] = await Promise.all([
    ctx.store.listSessions(profile.id),
    ctx.store.listAttempts(profile.id, { packId: pack.id }),
    ctx.store.listDaySummaries(profile.id),
  ]);
  const ownSessions = sessions.filter((s) => s.packId === pack.id);
  const counts = engine.statusCounts(states);
  const stats = factStats(
    attempts,
    summaries.filter((s) => s.packId === pack.id),
  );
  const today = systemClock.today();
  const lastPlayed = ownSessions.length ? ownSessions[ownSessions.length - 1]!.day : null;

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-garden-heading' },
    h('h3', { id: 'place-garden-heading', class: 'place-heading' }, plantIcon('tree'), 'Trädgården'),
    h('p', { class: 'muted place-about' }, `${pack.title} 1–10.`),
    h(
      'ul',
      { class: 'status-summary' },
      (['automatic', 'fluent', 'learning', 'new'] as const).map((s) =>
        h('li', { class: `status-${s}` }, h('strong', null, counts[s]), ` ${STATUS_TEXT[s]}`),
      ),
    ),
    h(
      'p',
      { class: 'muted' },
      `${meta.sessionsCompleted} fullständiga pass`,
      lastPlayed ? ` · senast ${formatDay(lastPlayed)}` : '',
      ` · ${meta.unlockedUnitIds.length} av ${pack.units.length} enheter upplåsta`,
    ),
    h('h4', null, 'Värmekarta'),
    heatmap(states, stats),
    h('h4', null, 'Svåra just nu'),
    hardList(states, engine.config, today),
    h('h4', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
    h('h4', null, 'Inställning'),
    h(
      'div',
      { class: 'settings' },
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: profile.settings.allowFree,
          onchange: (e: Event) => void save({ settings: { allowFree: (e.target as HTMLInputElement).checked } }),
        }),
        ' Fritt svar med sifferknappar när en fakta sitter (annars bara flerval)',
      ),
    ),
    h('h4', null, 'Startkoll'),
    h('p', { class: 'muted' }, 'En kort koll av vilka tabeller barnet redan kan. Den kan bara flytta fram barnet, aldrig bakåt.'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => showPlacementOffer(ctx, profile) }, 'Gör om startkollen'),
  );
}

/**
 * Facts the child finds hard right now, with the way the game helps
 * ("räknestigen"): grown-ups can use the same idea when talking about it.
 */
function hardList(states: Record<string, ItemState>, config: EngineConfig, today: string): HTMLElement {
  const hard = Object.values(states)
    .filter((s) => isStruggling(s, today, config.support))
    .map((s) => parseFactId(s.itemId))
    .sort((x, y) => x.a * x.b - y.a * y.b || x.a - y.a);
  if (hard.length === 0) return h('p', { class: 'muted' }, 'Inga just nu.');
  return h(
    'div',
    null,
    h(
      'p',
      { class: 'muted' },
      'Fel på flera dagar, eller länge utan att fastna. De här tas i steg från det barnet redan kan (räknestigen), och kommer sedan tillbaka utan hjälp.',
    ),
    h(
      'ul',
      { class: 'hard-list' },
      hard.map(({ a, b }) => h('li', null, h('strong', null, `${formatFact(a, b)} = ${a * b}`), ' – ', strategyFor(a, b).text)),
    ),
  );
}

const HEAT_CLASS = (s: ItemState | undefined) => {
  if (!s || s.status === 'new') return 'heat-new';
  if (s.status === 'learning') return s.box === 0 ? 'heat-learning-0' : 'heat-learning-1';
  return s.status === 'fluent' ? 'heat-fluent' : 'heat-automatic';
};

function heatmap(states: Record<string, ItemState>, stats: Map<string, FactStats>): HTMLElement {
  const detail = h('p', { class: 'heat-detail', 'aria-live': 'polite' }, 'Tryck på en ruta för detaljer.');
  const cells: HTMLElement[] = [h('div', { class: 'grid-corner' }, '×')];
  for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) cells.push(h('div', { class: 'grid-head' }, b));
  for (let a = MIN_FACTOR; a <= MAX_FACTOR; a++) {
    cells.push(h('div', { class: 'grid-head' }, a));
    for (let b = MIN_FACTOR; b <= MAX_FACTOR; b++) {
      const id = factId(a, b);
      const s = states[id];
      const st = stats.get(id);
      const text = describeFact(a, b, s, st);
      cells.push(h('button', { class: `heat-cell ${HEAT_CLASS(s)}`, type: 'button', 'aria-label': text, onclick: () => (detail.textContent = text) }));
    }
  }
  const legend = h(
    'ul',
    { class: 'heat-legend' },
    [
      ['heat-new', 'inte påbörjad'],
      ['heat-learning-0', 'ny'],
      ['heat-learning-1', 'övas'],
      ['heat-fluent', 'flytande'],
      ['heat-automatic', 'automatiserad'],
    ].map(([cls, label]) => h('li', null, h('span', { class: `heat-swatch ${cls}` }), label)),
  );
  return h('div', { class: 'heatmap-wrap' }, h('div', { class: 'heatmap', role: 'group', 'aria-label': 'Värmekarta' }, cells), legend, detail);
}

function describeFact(a: number, b: number, s: ItemState | undefined, st: FactStats | undefined): string {
  const parts = [`${formatFact(a, b)} = ${a * b}: ${STATUS_TEXT[s?.status ?? 'new']}`];
  if (st?.attempts) {
    parts.push(`${st.attempts} försök, ${Math.round((st.correct / st.attempts) * 100)} % rätt`);
    if (st.meanRtMs) parts.push(`snitt ${(st.meanRtMs / 1000).toFixed(1)} s`);
  }
  const worst = Object.entries(s?.confusions ?? {}).sort((x, y) => y[1] - x[1])[0];
  if (worst) parts.push(`vanligaste felsvar ${worst[0]}`);
  return parts.join(' · ');
}

function confusionList(states: Record<string, ItemState>): HTMLElement {
  const list = topConfusions(states, 8, (id) => {
    const { a, b } = parseFactId(id);
    return formatFact(a, b);
  });
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) => h('li', null, h('strong', null, c.fact), ` – svarade ${c.given} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`))),
  );
}
