import { s } from '../../shell/dom';
import type { PictureWords } from '../../shell/components/explain';

/** A lit window, for "Vad betyder bilderna?". */
function windowIcon(): SVGSVGElement {
  const svg = s('svg', { class: 'icon tower-window-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  svg.innerHTML = '<rect x="6" y="3" width="12" height="18" rx="6" fill="var(--sun)" stroke="var(--ink)" stroke-width="2"/>';
  return svg;
}

/** What the tower's pictures mean, for the child (docs/PLAN-ENKLARE.md, E4). */
export const TOWER_PICTURES = (): PictureWords[] => [
  { picture: windowIcon(), words: 'Ett fönster för varje del. Det lyser när du kan delen. Till slut lyser hela tornet.' },
];
