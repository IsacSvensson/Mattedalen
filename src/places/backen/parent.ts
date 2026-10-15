import type { Profile } from '../../storage';
import type { AppContext } from '../../shell/app';
import { icon } from '../../shell/components/icons';
import { h } from '../../shell/dom';
import { engineFor, loadProgress } from '../../shell/play';
import { formatDay, STATUS_TEXT } from '../../shell/stats';
import { partProgress } from './logic';
import { brookDeps, pack } from './pack';
import { showBrook } from './screens/brook';
import { runBrookPlacement } from './screens/placement';

/**
 * Bäcken's part of the parent view: how much of each part sits. A heat map of
 * the addition table, hard facts and the start check come in the next phase.
 */
export async function brookParentSection(ctx: AppContext, profile: Profile): Promise<HTMLElement> {
  const deps = brookDeps(ctx);
  const engine = engineFor(profile, deps);
  const { states, meta } = await loadProgress(profile, deps, engine);
  const sessions = (await ctx.store.listSessions(profile.id)).filter((s) => s.packId === pack.id);
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
    h('h4', null, 'Delarna'),
    h(
      'ul',
      { class: 'brook-parts parent' },
      parts.map((p) =>
        h(
          'li',
          { class: p.open ? undefined : 'closed' },
          h('span', { class: 'part-name' }, p.title),
          h('span', { class: 'part-count' }, p.open ? `${p.known} av ${p.total} sitter` : 'inte öppen än'),
        ),
      ),
    ),
    h('h4', null, 'Startkoll'),
    h('p', { class: 'muted' }, 'En kort koll av vad barnet redan kan. Den kan bara flytta fram barnet, aldrig bakåt.'),
    h('button', { class: 'soft-button', type: 'button', onclick: () => void runBrookPlacement(ctx, profile, () => showBrook(ctx, profile)) }, 'Gör om startkollen vid bäcken'),
  );
}
