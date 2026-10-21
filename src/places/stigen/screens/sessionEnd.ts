import type { SessionSummary } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { h } from '../../../shell/dom';
import { showPath } from './path';
import { readShown } from '../../../shell/components/readAloud';

/** The soft ending on Stigen: no score and no counts, just what was met and what sits today. */
export function showPathEnd(ctx: AppContext, profile: Profile, summary: SessionSummary): void {
  const daily = summary.mode === 'daily';
  const met = summary.introduced.length;
  const sits = summary.promoted.length;
  const lines = [
    met > 0 ? h('li', null, icon('lantern'), met === 1 ? 'En ny uppgift på stigen' : 'Nya uppgifter på stigen') : null,
    sits > 0 ? h('li', null, icon('check'), 'Lyktorna lyser lite mer') : null,
  ];
  const view = h(
    'main',
    { class: `screen session-end${daily ? ' asleep' : ''}` },
    h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(daily ? 'moon' : 'sun')),
    h('h1', null, daily ? 'Bra jobbat!' : 'Bra övat!'),
    daily ? h('p', { class: 'end-text' }, 'Stigen vilar nu. Kom tillbaka i morgon!') : null,
    lines.some(Boolean) ? h('ul', { class: 'end-list' }, lines) : null,
    h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showPath(ctx, profile) }, 'Till stigen'),
  );
  show(ctx, view);
  void readShown(ctx, profile, { auto: true });
}
