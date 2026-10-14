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

/** Replaces the visible screen. A screen may return a cleanup function for global listeners. */
export function show(ctx: AppContext, view: HTMLElement, cleanup?: Cleanup): void {
  current?.();
  current = cleanup;
  ctx.root.replaceChildren(view);
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
