import type { SessionSummary } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { showBrook } from './brook';

/** The soft ending at the brook: no score, just what was built today. */
export function showBrookEnd(ctx: AppContext, profile: Profile, summary: SessionSummary): void {
  const daily = summary.mode === 'daily';
  const met = summary.introduced.length;
  const sits = summary.promoted.length;
  const lines = [
    met > 0 ? h('li', null, icon('steps'), met === 1 ? '1 ny sten' : `${met} nya stenar`) : null,
    sits > 0 ? h('li', null, icon('check'), sits === 1 ? '1 sten sitter nu' : `${sits} stenar sitter nu`) : null,
    h('li', null, icon('drop'), `${summary.answered} hopp`),
  ];
  const view = h(
    'main',
    { class: `screen session-end${daily ? ' asleep' : ''}` },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(daily ? 'moon' : 'sun')),
    h('h1', null, daily ? 'Bra jobbat!' : 'Bra övat!'),
    daily ? h('p', { class: 'end-text' }, 'Bäcken vilar nu. Kom tillbaka i morgon!') : null,
    h('ul', { class: 'end-list' }, lines),
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showBrook(ctx, profile) }, 'Till bäcken'),
  );
  show(ctx, view);
}
