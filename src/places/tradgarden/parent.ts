import { isStruggling, systemClock, type EngineConfig, type ItemState } from '../../engine';
import {
  divisionStrategy,
  factId,
  formatDivision,
  formatFact,
  isDivisionId,
  isFactId,
  MAX_FACTOR,
  MIN_FACTOR,
  parseDivisionId,
  parseFactId,
  SHARE_TASKS,
  shareId,
  strategyFor,
} from '../../content/multiplication';
import { DEFAULT_DIVISION_SIGN, DIVISION_SIGNS, type DivisionSign } from '../../shell/divisionSign';
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

/** How delat med is written for this child; only once the garden has delat med. */
function divisionSignSetting(profile: Profile, save: SaveProfile): HTMLElement | null {
  if (!pack.items.some((it) => isDivisionId(it.id))) return null;
  const current = profile.settings.divisionSign ?? DEFAULT_DIVISION_SIGN;
  return h(
    'label',
    null,
    'Skriv delat med som ',
    h(
      'select',
      {
        'aria-label': 'Skriv delat med som',
        onchange: (e: Event) => void save({ settings: { divisionSign: (e.target as HTMLSelectElement).value as DivisionSign } }),
      },
      DIVISION_SIGNS.map((s) => h('option', { value: s.value, selected: s.value === current }, s.label)),
    ),
  );
}

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
      divisionSignSetting(profile, save),
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
  // Multiplications and divisions, by the size of the number (a "Dela lika" task is never timed, so never hard this way).
  const hard = Object.values(states)
    .filter((s) => (isFactId(s.itemId) || isDivisionId(s.itemId)) && isStruggling(s, today, config.support))
    .map((s) => hardFact(s.itemId))
    .sort((x, y) => x.size - y.size || x.text.localeCompare(y.text));
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
      hard.map(({ text, strategy }) => h('li', null, h('strong', null, text), ' – ', strategy)),
    ),
  );
}

function hardFact(id: string): { text: string; strategy: string; size: number } {
  if (isDivisionId(id)) {
    const { dividend, divisor, quotient } = parseDivisionId(id);
    return { text: `${formatDivision(dividend, divisor)} = ${quotient}`, strategy: divisionStrategy(quotient, divisor).text, size: dividend };
  }
  const { a, b } = parseFactId(id);
  return { text: `${formatFact(a, b)} = ${a * b}`, strategy: strategyFor(a, b).text, size: a * b };
}

/** How a fact is written for grown-ups: 3 × 7, 21 ÷ 3, or a "Dela lika" task in short. */
function factLabel(id: string): string {
  if (isFactId(id)) {
    const { a, b } = parseFactId(id);
    return formatFact(a, b);
  }
  if (isDivisionId(id)) {
    const { dividend, divisor } = parseDivisionId(id);
    return formatDivision(dividend, divisor);
  }
  const task = SHARE_TASKS.find((t) => shareId(t) === id);
  if (!task) return id;
  return task.kind === 'share' ? `Dela lika: ${task.total} i ${task.by} korgar` : `Dela lika: ${task.total}, ${task.by} i varje korg`;
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
  const list = topConfusions(states, 8, factLabel);
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) => h('li', null, h('strong', null, c.fact), ` – svarade ${c.given} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`))),
  );
}
