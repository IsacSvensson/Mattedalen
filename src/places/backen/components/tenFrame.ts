import { h, s } from '../../../shell/dom';

/**
 * Ten frames (two rows of five): `a` as filled dots, then `b` as rings, so
 * the two parts differ in shape and not only in colour. 7 + 3 fills one frame
 * exactly; 8 + 5 fills one and spills 3 into the next.
 */
export function tenFrame(a: number, b: number): HTMLElement {
  const total = a + b;
  const frames = Math.max(1, Math.ceil(total / 10));
  const cell = 26;
  const gap = 12;
  const width = 5 * cell + 8;
  const svg = s('svg', {
    class: 'ten-frame-svg',
    viewBox: `0 0 ${frames * width + (frames - 1) * gap} ${2 * cell + 8}`,
    'aria-hidden': 'true',
  });
  let markup = '';
  for (let f = 0; f < frames; f++) {
    const ox = f * (width + gap);
    markup += `<rect class="tf-frame" x="${ox + 1}" y="1" width="${width - 2}" height="${2 * cell + 6}" rx="8"/>`;
    for (let i = 0; i < 10; i++) {
      const n = f * 10 + i;
      const cx = ox + 4 + (i % 5) * cell + cell / 2;
      const cy = 4 + Math.floor(i / 5) * cell + cell / 2;
      markup += `<rect class="tf-cell" x="${cx - cell / 2}" y="${cy - cell / 2}" width="${cell}" height="${cell}"/>`;
      if (n < a) markup += `<circle class="tf-dot first" cx="${cx}" cy="${cy}" r="8"/>`;
      else if (n < total) markup += `<circle class="tf-dot second" cx="${cx}" cy="${cy}" r="7"/>`;
    }
  }
  svg.innerHTML = markup;
  return h('div', { class: 'ten-frame' }, svg);
}
