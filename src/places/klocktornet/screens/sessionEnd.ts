import type { SessionSummary } from '../../../engine';
import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../../shell/app';
import { icon } from '../../../shell/components/icons';
import { readShown } from '../../../shell/components/readAloud';
import { h } from '../../../shell/dom';
import { showTower } from './tower';

/** The soft ending in the tower: no score and no counts, just what was met and what sits today. */
export function showTowerEnd(ctx: AppContext, profile: Profile, summary: SessionSummary): void {
  const daily = summary.mode === 'daily';
  const lines = [
    summary.introduced.length > 0 ? h('li', null, icon('watch'), summary.introduced.length === 1 ? 'Något nytt i tornet' : 'Nya saker i tornet') : null,
    summary.promoted.length > 0 ? h('li', null, icon('check'), 'Fönstren lyser lite mer') : null,
  ];
  show(
    ctx,
    h(
      'main',
      { class: `screen session-end${daily ? ' asleep' : ''}` },
      h('div', { class: 'end-icon', 'aria-hidden': 'true' }, icon(daily ? 'moon' : 'sun')),
      h('h1', null, daily ? 'Bra jobbat!' : 'Bra övat!'),
      daily ? h('p', { class: 'end-text' }, 'Tornet vilar nu. Kom tillbaka i morgon!') : null,
      lines.some(Boolean) ? h('ul', { class: 'end-list' }, lines) : null,
      h('button', { class: 'big-button', type: 'button', autofocus: true, onclick: () => void showTower(ctx, profile) }, 'Till tornet'),
    ),
  );
  void readShown(ctx, profile, { auto: true });
}
