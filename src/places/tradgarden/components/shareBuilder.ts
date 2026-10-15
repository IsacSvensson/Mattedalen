import type { ShareTask } from '../../../content/multiplication';
import { h, s } from '../../../shell/dom';

export interface ShareBuilderOptions {
  task: ShareTask;
  /** Say how it came out when the pile is empty (the introduction and the help); not beside a question. */
  reveal?: boolean;
  /** Called once every berry is in a basket. */
  onDone?: () => void;
}

export const berry = () =>
  s(
    'svg',
    { class: 'berry', viewBox: '0 0 20 20', 'aria-hidden': 'true' },
    s('path', { d: 'M10 6c4.5 0 7 2.5 6.5 6.5S12.5 18.5 10 18.5 3 16.5 3.5 12.5 5.5 6 10 6Z', class: 'berry-fruit' }),
    s('path', { d: 'M10 6.5 7 3.5M10 6.5l3-3M10 6.5V2.5', class: 'berry-leaf' }),
  );

export const basketIcon = () =>
  s(
    'svg',
    { class: 'basket-shape', viewBox: '0 0 60 30', 'aria-hidden': 'true' },
    s('path', { d: 'M3 4h54l-6 23H9Z', class: 'basket-body' }),
    s('path', { d: 'M8 12h44M10 19h40', class: 'basket-weave' }),
  );

/**
 * "Dela lika" with the hands: berries in a pile and baskets below. Sharing
 * (12 berries in 3 baskets): the child deals the berries out, one at a time,
 * by dragging one to a basket or tapping a basket. A basket that already has
 * more than another waits, so the dealing stays fair. Grouping (12 berries,
 * 4 in each basket): one basket at a time is filled, and a new one comes out
 * when it is full. Then the child counts: in one basket, or the baskets.
 */
export function shareBuilder({ task, reveal = true, onDone }: ShareBuilderOptions): HTMLElement {
  let pile = task.total;
  let done = false;
  const counts: number[] = task.kind === 'share' ? Array<number>(task.by).fill(0) : [0];

  const pileEl = h('div', { class: 'share-pile', 'aria-hidden': 'true' });
  // As many baskets as there will be, so they share one row however narrow the screen.
  const basketsEl = h('div', { class: `share-baskets ${task.kind}`, style: `--n:${task.kind === 'share' ? task.by : task.answer}` });
  const status = h('p', { class: 'share-status', 'aria-live': 'polite' });
  const root = h('div', { class: 'share-builder' }, pileEl, basketsEl, status);

  const room = (i: number) => {
    if (task.kind === 'group') return i === counts.length - 1 && (counts[i] ?? 0) < task.by;
    // Fair dealing: no basket gets a second berry before every basket has one, and so on.
    return (counts[i] ?? 0) <= Math.min(...counts);
  };

  function put(i: number) {
    if (done || pile === 0) return;
    if (!room(i)) {
      const el = basketsEl.children[i] as HTMLElement | undefined;
      el?.classList.remove('wait');
      void el?.getBoundingClientRect();
      el?.classList.add('wait');
      status.textContent = task.kind === 'share' ? 'Ge de andra korgarna lika många först.' : `Den här korgen är full: ${task.by} i den.`;
      return;
    }
    pile--;
    counts[i] = (counts[i] ?? 0) + 1;
    status.textContent = ' ';
    if (task.kind === 'group' && counts[i] === task.by && pile > 0) counts.push(0);
    render();
    if (pile === 0) finish();
  }

  /** The basket a tap on the pile puts a berry in: the next one in turn. */
  const nextBasket = () => (task.kind === 'group' ? counts.length - 1 : counts.indexOf(Math.min(...counts)));

  function render() {
    pileEl.replaceChildren(...Array.from({ length: pile }, () => h('span', { class: 'pile-berry' }, berry())));
    basketsEl.replaceChildren(
      ...counts.map((n, i) =>
        h(
          'button',
          {
            class: `share-basket${task.kind === 'group' && n === task.by ? ' full' : ''}`,
            type: 'button',
            'data-basket': i,
            'aria-label': `Korg ${i + 1}: ${n} bär. Lägg ett bär här.`,
            disabled: done || pile === 0,
            onclick: () => put(i),
          },
          h('span', { class: 'basket-berries', 'aria-hidden': 'true' }, Array.from({ length: n }, berry)),
          basketIcon(),
        ),
      ),
    );
  }

  function finish() {
    done = true;
    render();
    if (reveal) status.textContent = task.kind === 'share' ? `${task.answer} i varje korg!` : `${task.answer} ${task.answer === 1 ? 'korg' : 'korgar'}!`;
    onDone?.();
  }

  // Dragging a berry from the pile to a basket. A tap on the pile deals to the next basket.
  let ghost: HTMLElement | null = null;
  let start: { x: number; y: number } | null = null;
  const moveGhost = (e: PointerEvent) => {
    if (ghost) ghost.style.transform = `translate(${e.clientX - 16}px, ${e.clientY - 16}px)`;
  };
  pileEl.addEventListener('pointerdown', (e) => {
    if (done || pile === 0) return;
    e.preventDefault();
    start = { x: e.clientX, y: e.clientY };
    pileEl.setPointerCapture(e.pointerId);
    ghost = h('span', { class: 'drag-berry', 'aria-hidden': 'true' }, berry());
    document.body.append(ghost);
    moveGhost(e);
  });
  pileEl.addEventListener('pointermove', moveGhost);
  const drop = (e: PointerEvent, cancelled: boolean) => {
    if (!ghost || !start) return;
    ghost.remove();
    ghost = null;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12;
    start = null;
    if (cancelled) return;
    if (!moved) return put(nextBasket());
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.share-basket');
    if (target && basketsEl.contains(target)) put(Number(target.dataset.basket));
  };
  pileEl.addEventListener('pointerup', (e) => drop(e, false));
  pileEl.addEventListener('pointercancel', (e) => drop(e, true));

  render();
  status.textContent =
    task.kind === 'share' ? `Dela ut bären lika i korgarna. Dra eller tryck.` : `Lägg ${task.by} bär i varje korg. Dra eller tryck.`;
  return root;
}

/** The task for a "Dela lika" item, from its picture hint. */
export function shareTaskOf(hints: { kind: string; data?: unknown }[]): ShareTask | undefined {
  return hints.find((x) => x.kind === 'share')?.data as ShareTask | undefined;
}
