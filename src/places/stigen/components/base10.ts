import { h, s } from '../../../shell/dom';

/**
 * Tens rods and unit cubes: 47 is four rods of ten and seven cubes. The cubes
 * lie in columns of five, so 7 is seen as 5 and 2 without counting.
 */
const CELL = 8;
const ROD_GAP = 4;

function rodsAndCubes(tens: number, ones: number): string {
  let markup = '';
  for (let t = 0; t < tens; t++) {
    const x = 2 + t * (CELL + ROD_GAP);
    markup += `<rect class="b10-rod" x="${x}" y="2" width="${CELL}" height="${10 * CELL}" rx="1.5"/>`;
    for (let k = 1; k < 10; k++) markup += `<path class="b10-line" d="M${x} ${2 + k * CELL} h${CELL}"/>`;
  }
  const left = 2 + tens * (CELL + ROD_GAP) + (tens && ones ? 6 : 0);
  for (let o = 0; o < ones; o++) {
    const col = Math.floor(o / 5);
    const row = o % 5;
    markup += `<rect class="b10-cube" x="${left + col * (CELL + 3)}" y="${2 + 10 * CELL - (row + 1) * (CELL + 2) + 2}" width="${CELL}" height="${CELL}" rx="1.5"/>`;
  }
  return markup;
}

function width(tens: number, ones: number): number {
  return 4 + tens * (CELL + ROD_GAP) + (tens && ones ? 6 : 0) + Math.ceil(ones / 5) * (CELL + 3);
}

/** A number as rods and cubes. */
export function base10(tens: number, ones: number): HTMLElement {
  const svg = s('svg', { class: 'b10-svg', viewBox: `0 0 ${Math.max(12, width(tens, ones))} ${10 * CELL + 4}`, 'aria-hidden': 'true' });
  svg.innerHTML = rodsAndCubes(tens, ones);
  return h('span', { class: 'base10' }, svg);
}

/** Two numbers as rods and cubes, side by side: 34 + 25. */
export function base10Sum(x: number, y: number): HTMLElement {
  return h(
    'span',
    { class: 'base10-sum' },
    base10(Math.floor(x / 10), x % 10),
    h('span', { class: 'b10-plus', 'aria-hidden': 'true' }, '+'),
    base10(Math.floor(y / 10), y % 10),
  );
}

export interface Base10BuilderOptions {
  /** The number to build. */
  target: number;
  /** What lies there from the start, e.g. 3 tens and 14 ones to change. */
  start?: { tens: number; ones: number };
  /** What to do, shown above the board. */
  instruction: string;
  /** Called once the number is built (and no ten ones are left to change). */
  onDone?: () => void;
}

const MAX_TENS = 10;
const MAX_ONES = 19;

/**
 * Building a number with rods and cubes: tap "ett tiotal" or "ett ental" (or
 * drag one to the board), and take one away again. With ten cubes or more on
 * the board, ten of them can be changed for a rod. Done when the board shows
 * the number with fewer than ten cubes.
 */
export function base10Builder({ target, start, instruction, onDone }: Base10BuilderOptions): HTMLElement {
  let tens = start?.tens ?? 0;
  let ones = start?.ones ?? 0;
  let done = false;
  const board = h('div', { class: 'b10-board', role: 'img' });
  const status = h('p', { class: 'b10-status', 'aria-live': 'polite' });
  const change = h('button', { class: 'soft-button b10-change', type: 'button', onclick: () => regroup() }, 'Byt 10 ental mot 1 tiotal');

  const addTen = source('rod', 'Lägg till ett tiotal', () => set(tens + 1, ones));
  const addOne = source('cube', 'Lägg till ett ental', () => set(tens, ones + 1));
  const takeTen = h('button', { class: 'b10-take', type: 'button', 'aria-label': 'Ta bort ett tiotal', onclick: () => set(tens - 1, ones) }, '−');
  const takeOne = h('button', { class: 'b10-take', type: 'button', 'aria-label': 'Ta bort ett ental', onclick: () => set(tens, ones - 1) }, '−');

  const root = h(
    'div',
    { class: 'b10-builder', 'data-target': target },
    h('p', { class: 'b10-instruction' }, instruction),
    board,
    h(
      'div',
      { class: 'b10-sources' },
      h('div', { class: 'b10-source-row' }, addTen.el, takeTen),
      h('div', { class: 'b10-source-row' }, addOne.el, takeOne),
    ),
    change,
    status,
  );

  function set(t: number, o: number) {
    if (done) return;
    tens = Math.max(0, Math.min(MAX_TENS, t));
    ones = Math.max(0, Math.min(MAX_ONES, o));
    render();
  }

  function regroup() {
    if (done || ones < 10 || tens >= MAX_TENS) return;
    tens++;
    ones -= 10;
    render();
  }

  function render() {
    board.replaceChildren(base10(tens, ones));
    board.setAttribute('aria-label', `${tens} tiotal och ${ones} ental`);
    takeTen.disabled = done || tens === 0;
    takeOne.disabled = done || ones === 0;
    addTen.el.disabled = done || tens >= MAX_TENS;
    addOne.el.disabled = done || ones >= MAX_ONES;
    change.hidden = done || ones < 10;
    const value = 10 * tens + ones;
    if (value === target && ones < 10) {
      done = true;
      for (const b of [takeTen, takeOne, addTen.el, addOne.el]) b.disabled = true;
      change.hidden = true;
      status.textContent = `${tens} tiotal och ${ones} ental är ${target}!`;
      onDone?.();
      return;
    }
    status.textContent = value === target ? 'Rätt mycket! Byt tio ental mot ett tiotal.' : `${tens} tiotal och ${ones} ental`;
  }

  /** A button that adds a rod or a cube when tapped, or when dragged to the board. */
  function source(kind: 'rod' | 'cube', label: string, add: () => void) {
    const picture = s('svg', { class: `b10-source-svg ${kind}`, viewBox: kind === 'rod' ? '0 0 12 84' : '0 0 12 12', 'aria-hidden': 'true' });
    picture.innerHTML = kind === 'rod' ? rodsAndCubes(1, 0) : `<rect class="b10-cube" x="2" y="2" width="${CELL}" height="${CELL}" rx="1.5"/>`;
    const el = h('button', { class: `b10-source ${kind}`, type: 'button', 'aria-label': label }, picture, h('span', { 'aria-hidden': 'true' }, kind === 'rod' ? 'tiotal' : 'ental'));
    let dragged = false;
    let ghost: HTMLElement | null = null;
    let from: { x: number; y: number } | null = null;
    el.addEventListener('click', () => {
      // A drag has already added its piece.
      if (dragged) {
        dragged = false;
        return;
      }
      add();
    });
    el.addEventListener('pointerdown', (e) => {
      if (el.disabled) return;
      from = { x: e.clientX, y: e.clientY };
      dragged = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!from) return;
      if (!ghost && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 12) {
        ghost = h('span', { class: `b10-ghost ${kind}`, 'aria-hidden': 'true' }, picture.cloneNode(true));
        document.body.append(ghost);
      }
      if (ghost) ghost.style.transform = `translate(${e.clientX - 10}px, ${e.clientY - 20}px)`;
    });
    const end = (e: PointerEvent, cancelled: boolean) => {
      from = null;
      if (!ghost) return;
      ghost.remove();
      ghost = null;
      // The click that may follow the drag is not one more piece.
      dragged = true;
      setTimeout(() => (dragged = false), 0);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!cancelled && target && board.contains(target)) add();
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
    return { el };
  }

  render();
  return root;
}
