import { hasBeenFluent, type ItemState } from '../../engine';
import { h } from '../dom';

/** Colour class of a fact in a heat map, by how well it is known. */
export function heatClass(s: ItemState | undefined): string {
  if (!s || s.status === 'new') return 'heat-new';
  if (s.status === 'learning') return s.box === 0 && !hasBeenFluent(s) ? 'heat-learning-0' : 'heat-learning-1';
  return s.status === 'fluent' ? 'heat-fluent' : 'heat-automatic';
}

export interface HeatmapOptions {
  /** The sign in the corner, e.g. "×" or "+". */
  corner: string;
  rows: number[];
  cols: number[];
  /** The fact in a cell: its state and a description read out and shown when tapped. */
  cell(row: number, col: number): { state: ItemState | undefined; text: string };
  label: string;
}

/** A table of facts coloured by status (rows × columns), with a legend and a detail line. */
export function heatmapView({ corner, rows, cols, cell, label }: HeatmapOptions): HTMLElement {
  const detail = h('p', { class: 'heat-detail', 'aria-live': 'polite' }, 'Tryck på en ruta för detaljer.');
  const cells: HTMLElement[] = [h('div', { class: 'grid-corner' }, corner)];
  for (const c of cols) cells.push(h('div', { class: 'grid-head' }, c));
  for (const r of rows) {
    cells.push(h('div', { class: 'grid-head' }, r));
    for (const c of cols) {
      const { state, text } = cell(r, c);
      cells.push(h('button', { class: `heat-cell ${heatClass(state)}`, type: 'button', 'aria-label': text, onclick: () => (detail.textContent = text) }));
    }
  }
  const legend = h(
    'ul',
    { class: 'heat-legend' },
    [
      ['heat-new', 'inte påbörjad'],
      ['heat-learning-0', 'ny'],
      ['heat-learning-1', 'övas'],
      ['heat-fluent', 'flytande'],
      ['heat-automatic', 'automatiserad'],
    ].map(([cls, text]) => h('li', null, h('span', { class: `heat-swatch ${cls}` }), text)),
  );
  const grid = h('div', { class: 'heatmap', role: 'group', 'aria-label': label }, cells);
  grid.style.setProperty('--cols', String(cols.length + 1));
  return h('div', { class: 'heatmap-wrap' }, grid, legend, detail);
}
