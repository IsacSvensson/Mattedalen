import type { FocusSet, SessionSummary } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { isDivisionId, isFactId, isShareId } from '../../../content/multiplication';
import { bloomIcon, plantIcon } from '../../../shell/components/plant';
import { h } from '../../../shell/dom';
import { showGarden } from './garden';
import { showSession } from './session';

/** The soft ending: no score and no counts, just what grew today (the garden then shows it, highlighted). */
export function showSessionEnd(ctx: AppContext, profile: Profile, summary: SessionSummary, focus?: FocusSet): void {
  const daily = summary.mode === 'daily';
  // Multiplications are plants; divisions and "Dela lika" are blossoms and fruit on them.
  const planted = summary.introduced.filter(isFactId).length;
  const blossomed = summary.introduced.filter((id) => isDivisionId(id) || isShareId(id)).length;
  const grew = summary.promoted.filter(isFactId).length;
  const ripened = summary.promoted.filter(isDivisionId).length;
  const lines = [
    planted > 0 ? h('li', null, plantIcon('seed'), planted === 1 ? 'Ett nytt frö planterat' : 'Nya frön planterade') : null,
    blossomed > 0 ? h('li', null, bloomIcon('blossom'), blossomed === 1 ? 'En ny blomma' : 'Nya blommor') : null,
    grew > 0 ? h('li', null, plantIcon('bush'), 'Plantor växte') : null,
    ripened > 0 ? h('li', null, bloomIcon('fruit'), 'Frukt mognade') : null,
  ];
  const highlight = new Set([...summary.introduced, ...summary.promoted]);

  const view = h(
    'main',
    { class: `screen session-end${daily ? ' asleep' : ''}` },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(daily ? 'moon' : 'sun')),
    h('h1', null, daily ? 'Bra jobbat!' : focus ? `Bra övat på ${focus.title}!` : 'Bra övat!'),
    daily ? h('p', { class: 'end-text' }, 'Trädgården behöver sova nu. Den växer medan du sover – kom tillbaka i morgon!') : null,
    lines.some(Boolean) ? h('ul', { class: 'end-list' }, lines) : null,
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showGarden(ctx, profile, highlight) }, 'Till trädgården'),
    focus
      ? h('button', { class: 'soft-button', type: 'button', onclick: () => void showSession(ctx, profile, 'focus', focus) }, `Öva ${focus.title} igen`)
      : null,
  );
  show(ctx, view);
}
