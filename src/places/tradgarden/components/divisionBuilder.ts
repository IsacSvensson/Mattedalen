import { h, s } from '../../../shell/dom';
import { arrayView } from './arrayView';

const ROWS = 10;
const GAP = 10;
const PAD = 6;

export interface DivisionBuilderOptions {
  /** The number shared out, e.g. 42 in 42 ÷ 6. */
  dividend: number;
  /** The length of each row, e.g. 6 in 42 ÷ 6. */
  divisor: number;
  /** Called once the rectangle holds exactly `dividend` dots. */
  onDone: () => void;
}

const dotsWord = (n: number) => `${n} ${n === 1 ? 'prick' : 'prickar'}`;
const rowsWord = (n: number) => `${n} ${n === 1 ? 'rad' : 'rader'}`;

/**
 * Delat med as a rectangle (see docs/PLAN-DELAT-MED.md): the rows are
 * `divisor` dots long, and the child drags down until there are `dividend`
 * dots. The number of rows is the answer, and the rectangle is the same as
 * for the family's multiplication (42 ÷ 6 is the rectangle of 7 × 6).
 * Dragging, tapping the last row, or the arrow keys and Enter all work.
 */
export function divisionBuilder({ dividend, divisor, onDone }: DivisionBuilderOptions): HTMLElement {
  const target = dividend / divisor;
  let rows = 0;
  let dragging = false;
  let done = false;

  const width = divisor * GAP + PAD;
  const height = ROWS * GAP + PAD;
  const dots: SVGCircleElement[][] = [];
  const board = s('svg', {
    class: 'builder-board division',
    viewBox: `0 0 ${width} ${height}`,
    style: `--ar:${width / height}`,
    role: 'slider',
    tabindex: 0,
    'aria-label': `Bygg ${dividend} prickar med ${divisor} i varje rad`,
    'aria-valuemin': 0,
    'aria-valuemax': ROWS,
  });
  board.append(s('rect', { x: 0.5, y: 0.5, width: width - 1, height: height - 1, rx: 4, class: 'array-frame' }));
  for (let r = 0; r < ROWS; r++) {
    const row: SVGCircleElement[] = [];
    for (let c = 0; c < divisor; c++) {
      const dot = s('circle', { cx: PAD / 2 + GAP / 2 + c * GAP, cy: PAD / 2 + GAP / 2 + r * GAP, r: 3.6, class: 'builder-dot' });
      row.push(dot);
      board.append(dot);
    }
    dots.push(row);
  }

  const instruction = h('p', { class: 'builder-instruction' }, `Dra nedåt tills det är ${dividend} prickar, ${divisor} i varje rad`);
  const size = h('p', { class: 'builder-size', 'aria-live': 'polite' });
  const showMe = h('button', { class: 'link-button', type: 'button', onclick: () => set(target, true) }, 'Visa mig');
  const boardWrap = h('div', { class: 'builder-wrap' }, board);
  const root = h('div', { class: 'array-builder division-builder' }, instruction, boardWrap, size, h('div', { class: 'builder-buttons' }, showMe));

  function render() {
    dots.forEach((row, r) => row.forEach((dot) => dot.classList.toggle('on', r < rows)));
    const n = rows * divisor;
    size.textContent = rows ? dotsWord(n) : ' ';
    size.classList.toggle('over', n > dividend);
    board.setAttribute('aria-valuenow', String(rows));
    board.setAttribute('aria-valuetext', `${rowsWord(rows)}, ${dotsWord(n)}`);
  }

  function set(next: number, release: boolean) {
    if (done) return;
    rows = Math.max(0, Math.min(ROWS, next));
    render();
    if (release) check();
  }

  function check() {
    const n = rows * divisor;
    if (rows === target) finish();
    else if (n > dividend) instruction.textContent = `${dotsWord(n)} – för många. Dra tillbaka till ${dividend}.`;
    else if (rows) instruction.textContent = `${dotsWord(n)}. Dra vidare till ${dividend}.`;
  }

  function finish() {
    done = true;
    showMe.remove();
    instruction.textContent = `${dividend} prickar: ${rowsWord(target)} med ${divisor} i varje!`;
    // Keep the dot size, so the rectangle stays where the child built it.
    const unit = board.getBoundingClientRect().height / height;
    const result = arrayView(target, divisor);
    if (unit > 0) result.style.setProperty('--unit', `${unit}px`);
    boardWrap.classList.add('done');
    boardWrap.replaceChildren(result);
    size.remove();
    onDone();
  }

  const rowAt = (e: PointerEvent) => {
    const box = board.getBoundingClientRect();
    const y = ((e.clientY - box.top) / box.height) * height - PAD / 2;
    return Math.min(ROWS, Math.max(1, Math.floor(y / GAP) + 1));
  };
  board.addEventListener('pointerdown', (e) => {
    if (done) return;
    // No focus ring from a finger or mouse; the keyboard reaches the board with Tab.
    e.preventDefault();
    dragging = true;
    board.setPointerCapture(e.pointerId);
    set(rowAt(e), false);
  });
  board.addEventListener('pointermove', (e) => {
    if (dragging) set(rowAt(e), false);
  });
  board.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    set(rowAt(e), true);
  });
  board.addEventListener('pointercancel', () => (dragging = false));
  board.addEventListener('keydown', (e) => {
    if (done) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') set(rows + 1, false);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') set(rows - 1, false);
    else if (e.key === 'Enter' || e.key === ' ') check();
    else return;
    e.preventDefault();
    // The same Enter must not also press "Nu du!", which appears when the rectangle is right.
    e.stopPropagation();
  });

  render();
  return root;
}
