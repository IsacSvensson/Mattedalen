import { s } from '../dom';

/** A rows × cols rectangle of dots: the visual meaning of a × b. */
export function arrayView(rows: number, cols: number, size: 'normal' | 'small' = 'normal'): SVGSVGElement {
  const gap = 10;
  const pad = 6;
  const width = cols * gap + pad;
  const height = rows * gap + pad;
  const dots: SVGElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(s('circle', { cx: pad / 2 + gap / 2 + c * gap, cy: pad / 2 + gap / 2 + r * gap, r: 3.6, class: 'array-dot', style: `--i:${r}` }));
    }
  }
  return s(
    'svg',
    // Fixed dot size: a small fact looks small, a big one big.
    { class: `array-view ${size}`, viewBox: `0 0 ${width} ${height}`, style: `--w:${width};--h:${height}`, role: 'img', 'aria-label': `${rows} ${rows === 1 ? 'rad' : 'rader'} med ${cols} ${cols === 1 ? 'prick' : 'prickar'}` },
    s('rect', { x: 0.5, y: 0.5, width: width - 1, height: height - 1, rx: 4, class: 'array-frame' }),
    ...dots,
  );
}
