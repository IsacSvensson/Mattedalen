import { isStruggling, systemClock, type Engine, type ItemId, type ItemState } from '../../engine';
import { parseTaskId, taskPrompt, taskWithAnswer } from '../../content/hundred';
import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { h } from '../../shell/dom';
import { engineFor, loadProgress } from '../../shell/play';
import { formatDay, STATUS_TEXT, topConfusions } from '../../shell/stats';
import { partProgress } from './logic';
import { pack, pathDeps } from './pack';

/**
 * Stigen's part of the parent view: how much of each part sits, what is hard
 * right now (with the way the game helps, so grown-ups can use the same idea),
 * and the most common mix-ups.
 */
export async function pathParentSection(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
  const deps = pathDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const sessions = (await ctx.store.listSessions(profile.id)).filter((s) => s.packId === pack.id);
  const counts = engine.statusCounts(states);
  const unlocked = new Set(engine.unlockedUnits(states, meta));
  const lastPlayed = sessions.length ? sessions[sessions.length - 1]!.day : null;
  const parts = partProgress(pack, states, unlocked);

  return h(
    'section',
    { class: 'place-section', 'aria-labelledby': 'place-path-heading' },
    h('h3', { id: 'place-path-heading', class: 'place-heading' }, icon('lantern'), 'Stigen'),
    h('p', { class: 'muted place-about' }, 'Talen till 100: tiotal och ental, över tiotalet, dubbla och halvera.'),
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
          h('span', { class: 'part-count' }, p.open ? `${p.known} av ${p.total} sitter` : 'inte öppen än'),
        ),
      ),
    ),
    h('h4', null, 'Svåra just nu'),
    hardList(states, engine),
    h('h4', null, 'Vanligaste förväxlingarna'),
    confusionList(states),
  );
}

/** Tasks the child finds hard right now, with the way the game helps. */
function hardList(states: Record<ItemId, ItemState>, engine: Engine): HTMLElement {
  const today = systemClock.today();
  const hard = Object.values(states).filter((s) => isStruggling(s, today, engine.config.support));
  if (hard.length === 0) return h('p', { class: 'muted' }, 'Inga just nu.');
  return h(
    'div',
    null,
    h('p', { class: 'muted' }, 'Fel på flera dagar, eller länge utan att fastna. De här tas i steg via tiotalet (räknestigen), med en tom tallinje.'),
    h(
      'ul',
      { class: 'hard-list' },
      hard.map((s) => {
        const strategy = engine.item(s.itemId).hints.find((x) => x.kind === 'strategy')?.text;
        return h('li', null, h('strong', null, taskWithAnswer(parseTaskId(s.itemId))), strategy ? ` – ${strategy}` : '');
      }),
    ),
  );
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
