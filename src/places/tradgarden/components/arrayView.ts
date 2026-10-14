import type { ArrayParts } from '../../../content/multiplication';
import { s } from '../../../shell/dom';

const GAP = 10;
const PAD = 6;
/** Extra space between the parts of a split rectangle. */
const PART_GAP = 6;

export interface ArrayViewOptions {
  size?: 'normal' | 'small';
  /** Split into coloured parts along one side (from the strategy). */
  parts?: ArrayParts;
}

/**
 * A rows × cols rectangle of dots: the visual meaning of a × b. With `parts`
 * the strategy becomes visible: 8 × 7 as two 4 × 7 halves in different
 * colours, 9 × 6 as 10 × 6 with the last row taken away.
 */
export function arrayView(rows: number, cols: number, options: ArrayViewOptions = {}): SVGSVGElement {
  const { size = 'normal', parts } = options;
  // Along the split side the drawn length may exceed the fact (e.g. 10 rows for 9 × 6).
  const splitLen = parts ? parts.sizes.reduce((x, y) => x + y, 0) : 0;
  const drawRows = parts?.axis === 'rows' ? splitLen : rows;
  const drawCols = parts?.axis === 'cols' ? splitLen : cols;
  const lastPart = parts ? parts.sizes.length - 1 : 0;
  const partOf = (i: number) => {
    if (!parts) return 0;
    let acc = 0;
    for (let p = 0; p < parts.sizes.length; p++) {
      acc += parts.sizes[p] as number;
      if (i < acc) return p;
    }
    return lastPart;
  };
  const shift = (i: number, axis: 'rows' | 'cols') => (parts?.axis === axis ? partOf(i) * PART_GAP : 0);

  const width = drawCols * GAP + PAD + (parts?.axis === 'cols' ? lastPart * PART_GAP : 0);
  const height = drawRows * GAP + PAD + (parts?.axis === 'rows' ? lastPart * PART_GAP : 0);
  const dots: SVGElement[] = [];
  for (let r = 0; r < drawRows; r++) {
    for (let c = 0; c < drawCols; c++) {
      const part = partOf(parts?.axis === 'cols' ? c : r);
      const removed = parts?.removeLast && part === lastPart;
      dots.push(
        s('circle', {
          cx: PAD / 2 + GAP / 2 + c * GAP + shift(c, 'cols'),
          cy: PAD / 2 + GAP / 2 + r * GAP + shift(r, 'rows'),
          r: 3.6,
          class: `array-dot part-${removed ? 'removed' : part}`,
          style: `--i:${r}`,
        }),
      );
    }
  }
  const label = `${rows} ${rows === 1 ? 'rad' : 'rader'} med ${cols} ${cols === 1 ? 'prick' : 'prickar'}`;
  return s(
    'svg',
    // Fixed dot size: a small fact looks small, a big one big.
    { class: `array-view ${size}`, viewBox: `0 0 ${width} ${height}`, style: `--w:${width};--h:${height}`, role: 'img', 'aria-label': label },
    s('rect', { x: 0.5, y: 0.5, width: width - 1, height: height - 1, rx: 4, class: 'array-frame' }),
    ...dots,
  );
}

/** The strategy's parts stored on an item's strategy hint, if any. */
export function partsOf(hints: { kind: string; data?: unknown }[]): ArrayParts | undefined {
  const data = hints.find((x) => x.kind === 'strategy')?.data as { parts?: ArrayParts } | undefined;
  return data?.parts;
}
