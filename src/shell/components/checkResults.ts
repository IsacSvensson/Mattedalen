import type { SessionRecord } from '../../storage';
import { h } from '../dom';
import { formatDay } from '../stats';

/**
 * A place's koll in the parent view, newest first: right answers per kind of
 * task (and how many of them came quickly). The same kinds of tasks every time,
 * not adapted to the child, so the results can be compared over time.
 */
export function checkResultsView(
  checks: readonly SessionRecord[],
  categories: readonly { id: string; title: string; short: string }[],
  about: string,
  empty: string,
): HTMLElement {
  const intro = h('p', { class: 'muted' }, about);
  if (!checks.length) return h('div', null, intro, h('p', { class: 'muted' }, empty));
  const rows = [...checks].sort((a, b) => b.startedAt - a.startedAt);
  const cell = (c: SessionRecord, id: string) => {
    const right = c.extra?.[`${id}:right`] ?? 0;
    const quick = c.extra?.[`${id}:quick`] ?? 0;
    return h('td', null, `${right} av ${c.extra?.[`${id}:total`] ?? 0}`, quick ? h('span', { class: 'muted quick' }, `${quick} snabbt`) : null);
  };
  return h(
    'div',
    null,
    intro,
    h(
      'table',
      { class: 'check-results' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Dag'), categories.map((c) => h('th', { scope: 'col', title: c.title }, c.short)))),
      h('tbody', null, rows.map((c) => h('tr', null, h('th', { scope: 'row' }, formatDay(c.day)), categories.map((cat) => cell(c, cat.id))))),
    ),
  );
}
