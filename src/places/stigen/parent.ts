import { isStruggling, systemClock, type Engine, type ItemId, type ItemState } from '../../engine';
import { CHECK_CATEGORIES, parseTaskId, taskPrompt, taskWithAnswer } from '../../content/hundred';
import { checkResultsView } from '../../shell/components/checkResults';
import type { SaveProfile } from '../../shell/place';
import { pathIsOpen } from './isOpen';
import { runPathPlacement } from './screens/placement';
import { showPath } from './screens/path';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { h } from '../../shell/dom';
import { engineFor, loadProgress } from '../../shell/play';
import { formatDay, knownOf, partNow, STATUS_TEXT, topConfusions, bestTimes, slowButRight } from '../../shell/stats';
import { limitedList } from '../../shell/components/limitedList';
import type { PlaceSummary } from '../../shell/place';
import { partProgress } from './logic';
import { pack, pathDeps, pathHeld } from './pack';
import { keepTerms } from '../../shell/words';

/** What Stigen covers, for grown-ups. */
export const PATH_ABOUT = 'Talen till 100: tiotal och ental, över tiotalet, dubbla och halvera.';

/**
 * Stigen's page in "För vuxna": the state (how much of each part sits), what
 * is hard right now (with the way the game helps, so grown-ups can use the same
 * idea) and the mix-ups, Stigen's check, and the start check.
 */
export async function pathParentPage(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<HTMLElement> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const sessions = (await ctx.store.listSessions(profile.id)).filter((s) => s.packId === pack.id);
  const open = await pathIsOpen(ctx, profile);
  const held = new Set(await pathHeld(ctx, profile));
  const counts = engine.statusCounts(states);
  const unlocked = new Set(engine.unlockedUnits(states, meta, undefined, await pathHeld(ctx, profile)));
  const lastPlayed = sessions.length ? sessions[sessions.length - 1]!.day : null;
  const parts = partProgress(pack, states, unlocked);

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-path-heading' },
    h('h2', { id: 'place-path-heading', class: 'place-heading' }, icon('lantern'), 'Stigen'),
    h('p', { class: 'muted place-about' }, PATH_ABOUT),
    open ? null : openingNote(save),
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
    h('p', { class: 'muted' }, 'En lykta på stigen för varje del. Den tänds när det mesta av delen sitter.'),
    h(
      'ul',
      { class: 'brook-parts parent' },
      parts.map((p) =>
        h(
          'li',
          { class: p.open ? undefined : 'closed' },
          h('span', { class: 'part-name' }, p.understanding ? `${p.title} (förståelse)` : p.title),
          h('span', { class: 'part-count' }, p.open ? `${p.known} av ${p.total} sitter` : held.has(p.id) ? 'väntar på bäcken' : 'inte öppen än'),
        ),
      ),
    ),
    h('h3', null, 'Svåra just nu'),
    hardList(states, engine),
    h('h3', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
    h('h3', null, 'Stigens koll'),
    checkResultsView(
      sessions.filter((x) => x.mode === 'check'),
      CHECK_CATEGORIES,
      'Samma sorts uppgifter ungefär var sjunde speldag på stigen, utan anpassning, så att det går att jämföra över tid. Uppgifterna dras från alla tal till 100, också sådana barnet inte har övat.',
      'Ingen koll än. Den första kommer andra dagen barnet är på stigen.',
    ),
    h('h3', null, 'Startkoll'),
    h('p', { class: 'muted' }, 'En kort koll av vad barnet redan kan. Den kan bara flytta fram barnet, aldrig bakåt.'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => void runPathPlacement(ctx, profile, () => showPath(ctx, profile)) }, 'Gör om startkollen på stigen'),
  );
}

/** Stigen opens by itself when going over ten sits at the brook; a grown-up who knows the child is ready opens it here. */
function openingNote(save: SaveProfile): HTMLElement {
  const note: HTMLElement = h(
    'div',
    { class: 'notice garden-opening' },
    h('p', null, 'Stigen är inte öppen än. Den öppnar av sig själv när barnet kan gå över tiotalet vid bäcken.'),
    h(
      'button',
      {
        class: 'soft-button',
        type: 'button',
        onclick: async () => {
          await save({ settings: { pathOpen: true } });
          note.replaceChildren(h('p', null, 'Stigen är öppen.'));
        },
      },
      'Öppna Stigen nu',
    ),
  );
  return note;
}

/** Tasks the child finds hard right now, with the way the game helps. */
function hardTasks(states: Record<ItemId, ItemState>, engine: Engine): { text: string; strategy: string | undefined }[] {
  const today = systemClock.today();
  return Object.values(states)
    .filter((s) => isStruggling(s, today, engine.config.support))
    .map((s) => ({ text: taskWithAnswer(parseTaskId(s.itemId)), strategy: engine.item(s.itemId).hints.find((x) => x.kind === 'strategy')?.text }));
}

/** Tasks the child finds hard right now, with the way the game helps. At most five, with "Visa alla". */
function hardList(states: Record<ItemId, ItemState>, engine: Engine): HTMLElement {
  const hard = hardTasks(states, engine);
  if (hard.length === 0) return h('p', { class: 'muted' }, 'Inga just nu.');
  return h(
    'div',
    null,
    h('p', { class: 'muted' }, 'Fel på flera dagar, eller länge utan att fastna. De här tas i steg via tiotalet (räknestigen), med en tom tallinje.'),
    limitedList(
      'ul',
      'hard-list',
      hard.map(({ text, strategy }) => h('li', null, h('strong', null, text), strategy ? ` – ${keepTerms(strategy)}` : '')),
    ),
  );
}

/** Stigen in the overview of "För vuxna": what the child is on, what is hardest, how much sits, and opening it early. */
export async function pathParentSummary(ctx: AppContext, profile: Profile, save: SaveProfile): Promise<PlaceSummary> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const hardest = hardTasks(states, engine)[0];
  const open = await pathIsOpen(ctx, profile);
  return {
    now: open ? partNow(pack, states, new Set(engine.unlockedUnits(states, meta, undefined, await pathHeld(ctx, profile)))) : null,
    hardest: hardest ? [hardest.text] : null,
    ...knownOf(pack, states),
    slow: slowButRight(engine, states),
    bestTimes: bestTimes(states),
    todo: open
      ? []
      : [
          {
            text: 'Stigen är inte öppen än. Den öppnar av sig själv när barnet kan gå över tiotalet vid bäcken.',
            action: { label: 'Öppna Stigen nu', run: () => save({ settings: { pathOpen: true } }) },
          },
        ],
  };
}

function confusionList(states: Record<ItemId, ItemState>): HTMLElement {
  const list = topConfusions(states, 8, (id) => taskPrompt(parseTaskId(id)).replace(/__/g, '?'));
  if (!list.length) return h('p', { class: 'muted' }, 'Inga förväxlingar ännu.');
  return h(
    'ol',
    { class: 'confusions' },
    list.map((c) => h('li', null, h('strong', null, c.fact), ` – svarade ${c.given} `, h('span', { class: 'muted' }, `(${c.count} ${c.count === 1 ? 'gång' : 'gånger'})`))),
  );
}
