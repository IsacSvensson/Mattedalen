import type { AppContext } from '../../app';
import { h } from '../../dom';
import { setWhere } from '../../resume';
import { aboutFacts } from '../intro';
import { showParentPage } from './frame';
import { showParent } from './parent';

/** "Så fungerar Mattedalen": the same four lines as the grown-ups' first start (docs/PLAN-ENKLARE.md, E2), for families who came before it. */
export function showAbout(ctx: AppContext, backTo?: string): void {
  setWhere({ kind: 'parent', page: 'about', profileId: backTo });
  showParentPage(
    ctx,
    { title: 'Så fungerar Mattedalen', back: () => void showParent(ctx, backTo) },
    h('section', { class: 'parent-section', 'aria-label': 'Så fungerar Mattedalen' }, aboutFacts()),
  );
}
