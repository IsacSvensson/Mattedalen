import type { Profile } from '../../../storage';
import { show, type AppContext } from '../../app';
import { toast } from '../../components/modal';
import { icon } from '../../components/icons';
import { h } from '../../dom';
import type { SaveProfile } from '../../place';

/**
 * A page in "För vuxna" below the overview (docs/PLAN-FORALDRAVYN.md): a top
 * bar with the way back to the overview and the page's name, and the page
 * itself. The phone's back button presses the way back (`backTarget`).
 */
export function showParentPage(
  ctx: AppContext,
  opts: { title: string; subtitle?: string; back: () => void; className?: string },
  ...content: (Node | null)[]
): void {
  const view = h(
    'main',
    { class: `screen parent parent-page${opts.className ? ` ${opts.className}` : ''}` },
    h(
      'header',
      { class: 'top-bar' },
      h('button', { class: 'icon-button', type: 'button', 'aria-label': 'Tillbaka', onclick: opts.back }, icon('back')),
      h('div', { class: 'parent-title' }, h('h1', null, opts.title), opts.subtitle ? h('p', { class: 'muted' }, opts.subtitle) : null),
    ),
    ...content,
  );
  show(ctx, view);
}

/**
 * Saves changes to a child; every setting goes through the same one. It always
 * merges into the latest saved version (a place may have saved to it); a new
 * name or animal redraws the page (`redraw`).
 */
export function profileSaver(ctx: AppContext, profile: Profile, redraw: () => Promise<void>): SaveProfile {
  return async (change) => {
    const stored = (await ctx.store.getProfile(profile.id)) ?? profile;
    const current = { ...stored, ...change, settings: { ...stored.settings, ...change.settings } };
    await ctx.store.saveProfile(current);
    toast('Sparat');
    if (change.name !== undefined || change.avatar !== undefined) await redraw();
  };
}

/** A row that leads to a page: an icon, a name and a line about it. */
export function pageRow(opts: { icon: Element | null; title: string; text?: string; onclick: () => void }): HTMLElement {
  return h(
    'li',
    null,
    h(
      'button',
      { class: 'parent-row', type: 'button', onclick: opts.onclick },
      opts.icon ? h('span', { class: 'parent-row-icon', 'aria-hidden': 'true' }, opts.icon) : null,
      h('span', { class: 'parent-row-text' }, h('strong', null, opts.title), opts.text ? h('span', { class: 'muted' }, opts.text) : null),
      h('span', { class: 'parent-row-go', 'aria-hidden': 'true' }, '›'),
    ),
  );
}
