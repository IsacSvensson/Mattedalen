import { h } from '../dom';

/** "Så kan du hjälpa till" under "Svåra just nu" on a place's page (docs/PLAN-ENKLARE.md, E4). */
export function helpTip(tip: string | null | undefined): HTMLElement | null {
  return tip ? h('p', { class: 'help-tip' }, h('strong', null, 'Så kan du hjälpa till: '), tip) : null;
}
