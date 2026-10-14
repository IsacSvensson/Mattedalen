import type { FocusSet, SessionSummary } from '../../engine';
import type { Profile } from '../../storage';
import { show, type AppContext } from '../app';
import { icon } from '../components/icons';
import { plantIcon } from '../components/plant';
import { h } from '../dom';
import { showGarden } from './garden';
import { showSession } from './session';

/** The soft ending: no score, just what grew today. */
export function showSessionEnd(ctx: AppContext, profile: Profile, summary: SessionSummary, focus?: FocusSet): void {
  const daily = summary.mode === 'daily';
  const planted = summary.introduced.length;
  const grew = summary.promoted.length;
  const lines = [
    planted > 0 ? h('li', null, plantIcon('seed'), planted === 1 ? '1 nytt frö planterat' : `${planted} nya frön planterade`) : null,
    grew > 0 ? h('li', null, plantIcon('bush'), grew === 1 ? '1 planta växte' : `${grew} plantor växte`) : null,
    h('li', null, plantIcon('sprout'), `${summary.answered} gånger vattnat`),
  ];
  const highlight = new Set([...summary.introduced, ...summary.promoted]);

  const view = h(
    'main',
    { class: `screen session-end${daily ? ' asleep' : ''}` },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(daily ? 'moon' : 'sun')),
    h('h1', null, daily ? 'Bra jobbat!' : focus ? `Bra övat på ${focus.title}!` : 'Bra övat!'),
    daily ? h('p', { class: 'end-text' }, 'Trädgården behöver sova nu. Den växer medan du sover – kom tillbaka i morgon!') : null,
    h('ul', { class: 'end-list' }, lines),
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showGarden(ctx, profile, highlight) }, 'Till trädgården'),
    focus
      ? h('button', { class: 'soft-button', type: 'button', onclick: () => void showSession(ctx, profile, 'focus', focus) }, `Öva ${focus.title} igen`)
      : null,
  );
  show(ctx, view);
}
