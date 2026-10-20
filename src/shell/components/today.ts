import { h } from '../dom';
import { icon, type IconName } from './icons';

/** Something left to do today: the day's session at a place. */
export interface TodayItem {
  icon: IconName;
  /** What the session is called, e.g. "Vattna trädgården". */
  label: string;
  /** The place's state today, e.g. "Trädgården är törstig." */
  note: string;
  start: () => void;
}

/**
 * "I dag" in the valley's corner (docs/PLAN-DALEN.md): a round button with a
 * sun and a small dot when something is left today, never a number. A tap
 * opens a small card with what is left; a row starts that session. Places
 * that rest today are named at the bottom. With nothing left there is no
 * button at all.
 */
export function today(items: TodayItem[], resting: { icon: Element; text: string }[]): HTMLElement | null {
  if (!items.length) return null;
  const close = h('button', { class: 'icon-button today-close', type: 'button', 'aria-label': 'Stäng', 'data-back': '', onclick: () => toggle(false) }, icon('close'));
  const card = h(
    'div',
    { class: 'today-card', id: 'today-card', role: 'dialog', 'aria-label': 'I dag', tabindex: -1, hidden: true },
    h('div', { class: 'today-head' }, icon('sun'), h('h2', null, 'I dag'), close),
    h(
      'ul',
      { class: 'today-list' },
      items.map((item) =>
        h(
          'li',
          null,
          h(
            'button',
            { class: 'today-go', type: 'button', onclick: () => item.start() },
            h('span', { class: 'today-go-icon' }, icon(item.icon)),
            h('span', { class: 'today-go-text' }, h('strong', null, item.label), h('span', null, item.note)),
          ),
        ),
      ),
    ),
    resting.map((r) => h('p', { class: 'today-rest' }, r.icon, h('span', null, r.text))),
  );
  const button = h(
    'button',
    {
      class: 'today-button',
      type: 'button',
      'aria-label': 'I dag. Det här kan du göra i dag',
      'aria-expanded': 'false',
      'aria-controls': 'today-card',
      onclick: () => toggle(card.hidden !== false),
    },
    icon('sun'),
    // The word under the sun: a seven-year-old does not know a sun is a button.
    h('span', { class: 'today-label', 'aria-hidden': 'true' }, 'I dag'),
    h('span', { class: 'today-dot', 'aria-hidden': 'true' }),
  );
  const el = h('div', { class: 'today' }, button, card);

  function toggle(open: boolean) {
    card.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    // The card itself takes focus, so a tap does not light up its first row; Tab goes on to the rows.
    if (open) card.focus();
    else button.focus();
  }
  // Escape and a tap outside the card close it.
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) toggle(false);
  });
  const outside = (e: PointerEvent) => {
    // Gone with its screen: stop listening.
    if (!el.isConnected) return document.removeEventListener('pointerdown', outside, true);
    if (!card.hidden && !el.contains(e.target as Node)) toggle(false);
  };
  document.addEventListener('pointerdown', outside, true);
  return el;
}
