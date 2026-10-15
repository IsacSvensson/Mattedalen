import type { PersistStatus, ProgressStore } from '../storage';
import type { Place } from './place';
import { setScreenBusy } from './pwa';

export interface AppContext {
  root: HTMLElement;
  store: ProgressStore;
  /** The places in the valley, in map order. */
  places: Place[];
  storageKind: 'indexeddb' | 'memory';
  persist: PersistStatus;
}

type Cleanup = () => void;

let current: Cleanup | undefined;

/**
 * The phone's back button (and the browser's) goes back one screen instead of
 * closing the app: it presses the screen's own way back. That is, in order, the
 * cancel of an open dialog, a button marked `data-back`, the home or close
 * button at the top, the child's animal (to the valley, or to the list of
 * players), on an offer the "not now" choice, and on an ending the button
 * onwards. Only where there is no way back (the list of players) does the app
 * close. One extra history entry is kept while there is a way back.
 */
const BACK_SELECTORS = [
  '.modal-overlay .link-button',
  '[data-back]',
  '.top-bar .icon-button',
  '.scene-controls .icon-button',
  '.avatar-button',
  '.placement-offer .soft-button',
  '.session-end .big-button',
];

export function backTarget(root: ParentNode): HTMLElement | null {
  for (const selector of BACK_SELECTORS) {
    const el = [...root.querySelectorAll<HTMLElement>(selector)].find((e) => !(e as HTMLButtonElement).disabled && e.getClientRects().length > 0);
    if (el) return el;
  }
  return null;
}

let backArmed = false;
let backListening = false;

function armBack(): void {
  if (!backListening) {
    backListening = true;
    window.addEventListener('popstate', () => {
      backArmed = false;
      const target = backTarget(document);
      if (!target) {
        // Nothing to go back to: leave, as the button would without the app.
        history.back();
        return;
      }
      target.click();
      // A way back that did not change the screen (a dialog closed) keeps the next back press.
      setTimeout(armBack, 0);
    });
  }
  if (backArmed || !backTarget(document)) return;
  history.pushState({ mattedalen: 'back' }, '');
  backArmed = true;
}

/** Replaces the visible screen. A screen may return a cleanup function for global listeners. */
export function show(ctx: AppContext, view: HTMLElement, cleanup?: Cleanup): void {
  current?.();
  current = cleanup;
  ctx.root.replaceChildren(view);
  armBack();
  // Games (a session, challenge, duel or start check) are never interrupted by an update.
  setScreenBusy(view.classList.contains('session'));
  // Move focus to the new screen for keyboard and screen-reader users.
  const focusTarget = view.querySelector<HTMLElement>('[autofocus], h1');
  if (focusTarget) {
    if (!focusTarget.hasAttribute('tabindex') && focusTarget.tagName === 'H1') focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}
