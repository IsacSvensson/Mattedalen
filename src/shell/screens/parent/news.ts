import type { AppContext } from '../../app';
import { h } from '../../dom';
import { NEWS, newsItemView } from '../../news';
import { setWhere } from '../../resume';
import { formatDay } from '../../stats';
import { showParentPage } from './frame';
import { showParent } from './parent';

/** "Nytt i appen": every post of what is new, newest first (docs/PLAN-UPPDATERING.md, U2). */
export function showNews(ctx: AppContext, backTo?: string): void {
  setWhere({ kind: 'parent', page: 'news', profileId: backTo });
  const days = [...new Set(NEWS.map((n) => n.day))];
  showParentPage(
    ctx,
    { title: 'Nytt i appen', back: () => void showParent(ctx, backTo) },
    ...days.map((day) =>
      h(
        'section',
        { class: 'parent-section news', 'aria-label': formatDay(day) },
        h('h2', null, formatDay(day)),
        h('ul', { class: 'news-list' }, NEWS.filter((n) => n.day === day).map(newsItemView)),
      ),
    ),
  );
}
