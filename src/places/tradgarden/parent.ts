import { isStruggling, systemClock, type EngineConfig, type ItemState } from '../../engine';
import { factId, formatFact, MAX_FACTOR, MIN_FACTOR, parseFactId, strategyFor } from '../../content/multiplication';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { plantIcon } from '../../shell/components/plant';
import { heatmapView } from '../../shell/components/heatmap';
import { h } from '../../shell/dom';
import type { SaveProfile } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { factStats, formatDay, STATUS_TEXT, topConfusions, type FactStats } from '../../shell/stats';
import { gardenDeps, pack } from './pack';
import { gardenIsOpen } from './isOpen';
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
  const open = await gardenIsOpen(ctx, profile, states);

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-garden-heading' },
    h('h3', { id: 'place-garden-heading', class: 'place-heading' }, plantIcon('tree'), 'Trädgården'),
    h('p', { class: 'muted place-about' }, `${pack.title} 1–10.`),
    open ? null : openingNote(save),
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
    h('button', { class: 'soft-button', type: 'button', onclick: () => void showPlacementOffer(ctx, profile) }, 'Gör om startkollen'),
  );
}

/**
 * A new child starts at the brook. The garden opens by itself when doubles and
 * going over ten sit there; a grown-up who knows the child is ready opens it here.
 */
function openingNote(save: SaveProfile): HTMLElement {
  const note: HTMLElement = h(
    'div',
    { class: 'notice garden-opening' },
    h('p', null, 'Trädgården är inte öppen än. Den öppnar av sig själv när dubblor och övergången över tiotalet sitter vid bäcken.'),
    h(
      'button',
      {
        class: 'soft-button',
        type: 'button',
        onclick: async () => {
          await save({ settings: { gardenOpen: true } });
          note.replaceChildren(h('p', null, 'Trädgården är öppen.'));
        },
      },
      'Öppna Trädgården nu',
    ),
  );
  return note;
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

function heatmap(states: Record<string, ItemState>, stats: Map<string, FactStats>): HTMLElement {
  const factors = Array.from({ length: MAX_FACTOR - MIN_FACTOR + 1 }, (_, i) => MIN_FACTOR + i);
  return heatmapView({
    corner: '×',
    rows: factors,
    cols: factors,
    label: 'Värmekarta',
    cell: (a, b) => ({ state: states[factId(a, b)], text: describeFact(a, b, states[factId(a, b)], stats.get(factId(a, b))) }),
  });
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
