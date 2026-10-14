import type { ArrayParts } from '../../content/multiplication';
import { h, s } from '../dom';
import { icon } from './icons';
import { arrayView } from './arrayView';

const BOARD = 10;
const GAP = 10;
const PAD = 6;
const SIZE = BOARD * GAP + PAD;

export interface ArrayBuilderOptions {
  rows: number;
  cols: number;
  parts?: ArrayParts;
  /** The child already knows the mirrored fact: start from it and turn it around. */
  startRotated?: boolean;
  /** Called once the rectangle is right. */
  onDone: () => void;
}

/**
 * Introduction of a new fact: the child drags out a rows × cols rectangle on
 * a 10 × 10 board of dots and can turn it 90°. Building the right rectangle
 * reveals how the strategy splits it into known parts.
 */
export function arrayBuilder({ rows, cols, parts, startRotated = false, onDone }: ArrayBuilderOptions): HTMLElement {
  let cur = startRotated ? { r: cols, c: rows } : { r: 0, c: 0 };
  let dragging = false;
  let done = false;

  const dots: SVGCircleElement[][] = [];
  const board = s('svg', {
    class: 'builder-board',
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    role: 'img',
    'aria-label': `Bygg ${rows} rader med ${cols} i varje`,
  });
  board.append(s('rect', { x: 0.5, y: 0.5, width: SIZE - 1, height: SIZE - 1, rx: 4, class: 'array-frame' }));
  for (let r = 0; r < BOARD; r++) {
    const row: SVGCircleElement[] = [];
    for (let c = 0; c < BOARD; c++) {
      const dot = s('circle', { cx: PAD / 2 + GAP / 2 + c * GAP, cy: PAD / 2 + GAP / 2 + r * GAP, r: 3.6, class: 'builder-dot' });
      row.push(dot);
      board.append(dot);
    }
    dots.push(row);
  }

  const size = h('p', { class: 'builder-size', 'aria-live': 'polite' });
  const instruction = h(
    'p',
    { class: 'builder-instruction' },
    startRotated ? `Du kan redan ${cols} × ${rows}. Vrid den!` : `Dra ut ${rows} ${rows === 1 ? 'rad' : 'rader'} med ${cols} i varje`,
  );
  const rotate = h('button', { class: 'soft-button', type: 'button', onclick: () => turn() }, icon('rotate'), 'Vrid');
  const showMe = h('button', { class: 'link-button', type: 'button', onclick: () => set({ r: rows, c: cols }, true) }, 'Visa mig');
  const boardWrap = h('div', { class: 'builder-wrap' }, board);
  const root = h('div', { class: 'array-builder' }, instruction, boardWrap, size, h('div', { class: 'builder-buttons' }, rotate, showMe));

  function render() {
    for (let r = 0; r < BOARD; r++) {
      for (let c = 0; c < BOARD; c++) dots[r]![c]!.classList.toggle('on', r < cur.r && c < cur.c);
    }
    size.textContent = cur.r && cur.c ? `${cur.r} × ${cur.c}` : ' ';
    rotate.disabled = !(cur.r && cur.c);
  }

  function set(next: { r: number; c: number }, release: boolean) {
    if (done) return;
    cur = next;
    render();
    if (release) check();
  }

  function check() {
    if (cur.r === rows && cur.c === cols) {
      finish();
    } else if (cur.r === cols && cur.c === rows) {
      instruction.textContent = `Nästan! Det där är ${cur.r} × ${cur.c}. Vrid den!`;
    } else if (cur.r && cur.c) {
      instruction.textContent = `Det där är ${cur.r} × ${cur.c}. Vi söker ${rows} rader med ${cols} i varje.`;
    }
  }

  function turn() {
    if (done || !(cur.r && cur.c)) return;
    board.classList.remove('turning');
    // Restart the turn animation.
    void board.getBoundingClientRect();
    board.classList.add('turning');
    set({ r: cur.c, c: cur.r }, true);
  }

  function finish() {
    done = true;
    rotate.remove();
    showMe.remove();
    instruction.textContent = rows === cols ? `${rows} × ${cols} – en kvadrat!` : `Där är ${rows} × ${cols}!`;
    // Keep the board's dot size so the rectangle stays where the child built it.
    const unit = board.getBoundingClientRect().width / SIZE;
    const result = arrayView(rows, cols, { parts });
    if (unit > 0) result.style.setProperty('--unit', `${unit}px`);
    boardWrap.classList.add('done');
    boardWrap.replaceChildren(result);
    size.remove();
    onDone();
  }

  const cellAt = (e: PointerEvent) => {
    const box = board.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * SIZE - PAD / 2;
    const y = ((e.clientY - box.top) / box.height) * SIZE - PAD / 2;
    const clampCell = (v: number) => Math.min(BOARD, Math.max(1, Math.floor(v / GAP) + 1));
    return { r: clampCell(y), c: clampCell(x) };
  };
  board.addEventListener('pointerdown', (e) => {
    if (done) return;
    dragging = true;
    board.setPointerCapture(e.pointerId);
    set(cellAt(e), false);
  });
  board.addEventListener('pointermove', (e) => {
    if (dragging) set(cellAt(e), false);
  });
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    set(cellAt(e), true);
  };
  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', () => (dragging = false));

  render();
  return root;
}
