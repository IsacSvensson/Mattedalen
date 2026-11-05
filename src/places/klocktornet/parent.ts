import { isStruggling, plausibleAnswer, systemClock, type Engine, type ItemId, type ItemState } from '../../engine';
import { parseTaskId, taskWithAnswer } from '../../content/clock';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { helpTip } from '../../shell/components/helpTip';
import { icon } from '../../shell/components/icons';
import { limitedList } from '../../shell/components/limitedList';
import { h } from '../../shell/dom';
import type { PlaceSummary, SaveProfile } from '../../shell/place';
import { engineFor, loadProgress } from '../../shell/play';
import { bestTimes, formatDay, knownOf, partNow, partNowUnit, slowButRight, STATUS_TEXT, topConfusions } from '../../shell/stats';
import { partProgress } from '../stigen/logic';
import { towerIsOpen } from './isOpen';
import { pack, towerDeps, towerHeld } from './pack';
import { TOWER_TIPS } from './tips';

/** What Klocktornet covers, for grown-ups. */
export const TOWER_ABOUT = 'Klockan: hela och halva timmar, kvart och fem minuter, analogt och digitalt.';
const CLOSED_FOR_ADULTS = 'Klocktornet är inte öppet än. Det öppnar av sig självt när barnet kan små summor vid bäcken.';

/**
 * Klocktornet's page in "För vuxna" (docs/PLAN-KLOCKAN.md, KL4): the state,
 * the parts with how much of each sits, what is hard right now and the mix-ups.
 */
export async function towerParentPage(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<HTMLElement> {
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const sessions = (await ctx.store.listSessions(profile.id)).filter((s) => s.packId === pack.id);
  const open = await towerIsOpen(ctx, profile);
  const heldIds = await towerHeld(ctx, profile);
  const held = new Set(heldIds);
  const counts = engine.statusCounts(states);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, heldIds));
  const lastPlayed = sessions.length ? sessions[sessions.length - 1]!.day : null;
  const parts = partProgress(pack, states, unlocked);

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-tower-heading' },
    h('h2', { id: 'place-tower-heading', class: 'place-heading' }, icon('watch'), 'Klocktornet'),
    h('p', { class: 'muted place-about' }, TOWER_ABOUT),
    open ? null : openingNote(save),
    h('h3', null, 'Läget'),
    h(
      'ul',
      { class: 'status-summary' },
      (['automatic', 'fluent', 'learning', 'new'] as const).map((s) => h('li', { class: `status-${s}` }, h('strong', null, counts[s]), ` ${STATUS_TEXT[s]}`)),
    ),
    h('p', { class: 'muted' }, `${meta.sessionsCompleted} fullständiga pass`, lastPlayed ? ` · senast ${formatDay(lastPlayed)}` : '', ` · ${unlocked.size} av ${pack.units.length} delar öppna`),
    h('h4', null, 'Delarna'),
    h('p', { class: 'muted' }, 'Ett fönster i tornet för varje del. Det tänds när det mesta av delen sitter. Klockan är förståelse: ingen tid räknas.'),
    h(
      'ul',
      { class: 'brook-parts parent' },
      parts.map((p) =>
        h(
          'li',
          { class: p.open ? undefined : 'closed' },
          h('span', { class: 'part-name' }, p.title),
          h('span', { class: 'part-count' }, p.open ? `${p.known} av ${p.total} sitter` : held.has(p.id) ? 'väntar på stigen' : 'inte öppen än'),
        ),
      ),
    ),
    h('h3', null, 'Svåra just nu'),
    hardList(states, engine),
    open ? helpTip(TOWER_TIPS[partNowUnit(pack, states, unlocked)?.id ?? '']) : null,
    h('h3', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
  );
}

/** The tower opens by itself when small sums sit at the brook; a grown-up who knows the child is ready opens it here. */
function openingNote(save: SaveProfile): HTMLElement {
  const note: HTMLElement = h(
    'div',
    { class: 'notice garden-opening' },
    h('p', null, CLOSED_FOR_ADULTS),
    h(
      'button',
      {
        class: 'soft-button',
        type: 'button',
        onclick: async () => {
          await save({ settings: { towerOpen: true } });
          note.replaceChildren(h('p', null, 'Klocktornet är öppet.'));
        },
      },
      'Öppna Klocktornet nu',
    ),
  );
  return note;
}

function hardTasks(states: Record<ItemId, ItemState>, engine: Engine): { text: string; strategy: string | undefined }[] {
  const today = systemClock.today();
  return Object.values(states)
    .filter((s) => isStruggling(s, today, engine.config.support))
    .map((s) => ({ text: taskWithAnswer(parseTaskId(s.itemId)), strategy: engine.item(s.itemId).hints.find((x) => x.kind === 'strategy')?.text }));
}

function hardList(states: Record<ItemId, ItemState>, engine: Engine): HTMLElement {
  const hard = hardTasks(states, engine);
  if (hard.length === 0) return h('p', { class: 'muted' }, 'Inga just nu.');
  return limitedList(
    'ul',
    'hard-list',
    hard.map(({ text, strategy }) => h('li', null, h('strong', null, text), strategy ? h('span', { class: 'muted hard-way' }, strategy) : null)),
  );
}

function confusionList(states: Record<ItemId, ItemState>): HTMLElement {
  const list = topConfusions(states, 8, (id) => taskWithAnswer(parseTaskId(id)), (given) => plausibleAnswer(pack, given));
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) => h('li', null, h('strong', null, c.fact), `: svarade ${c.given} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`))),
  );
}

/** The tower in the overview of "För vuxna": what the child is on, what is hardest, how much sits, and opening it early. */
export async function towerParentSummary(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<PlaceSummary> {
  const deps = towerDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const hardest = hardTasks(states, engine)[0];
  const open = await towerIsOpen(ctx, profile);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, await towerHeld(ctx, profile)));
  return {
    now: open ? partNow(pack, states, unlocked) : null,
    tip: open ? (TOWER_TIPS[partNowUnit(pack, states, unlocked)?.id ?? ''] ?? null) : null,
    hardest: hardest ? [hardest.text] : null,
    ...knownOf(pack, states),
    slow: slowButRight(engine, states),
    bestTimes: bestTimes(states),
    todo: open ? [] : [{ text: CLOSED_FOR_ADULTS, action: { label: 'Öppna Klocktornet nu', run: () => save({ settings: { towerOpen: true } }) } }],
  };
}
