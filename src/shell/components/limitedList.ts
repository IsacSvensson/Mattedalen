import { h } from '../dom';

/**
 * A list that shows its first few rows, with "Visa alla" for the rest, so a
 * page in "För vuxna" stays short (docs/PLAN-FORALDRAVYN.md).
 */
export function limitedList(tag: 'ul' | 'ol', className: string, rows: HTMLElement[], max = 5): HTMLElement {
  const list = h(tag, { class: className }, rows);
  if (rows.length <= max) return list;
  for (const row of rows.slice(max)) row.hidden = true;
  const more: HTMLElement = h(
    'button',
    {
      class: 'link-button show-all',
      type: 'button',
      onclick: () => {
        for (const row of rows) row.hidden = false;
        more.remove();
      },
    },
    `Visa alla ${rows.length}`,
  );
  return h('div', null, list, more);
}
