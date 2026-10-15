import type { SessionSummary } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { showPath } from './path';

/** The soft ending on Stigen: no score, just what was met and what sits today. */
export function showPathEnd(ctx: AppContext, profile: Profile, summary: SessionSummary): void {
  const daily = summary.mode === 'daily';
  const met = summary.introduced.length;
  const sits = summary.promoted.length;
  const lines = [
    met > 0 ? h('li', null, icon('lantern'), met === 1 ? '1 ny uppgift' : `${met} nya uppgifter`) : null,
    sits > 0 ? h('li', null, icon('check'), sits === 1 ? '1 uppgift sitter nu' : `${sits} uppgifter sitter nu`) : null,
    h('li', null, icon('steps'), `${summary.answered} steg på stigen`),
  ];
  const view = h(
    'main',
    { class: `screen session-end${daily ? ' asleep' : ''}` },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(daily ? 'moon' : 'sun')),
    h('h1', null, daily ? 'Bra jobbat!' : 'Bra övat!'),
    daily ? h('p', { class: 'end-text' }, 'Stigen vilar nu. Kom tillbaka i morgon!') : null,
    h('ul', { class: 'end-list' }, lines),
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showPath(ctx, profile) }, 'Till stigen'),
  );
  show(ctx, view);
}
