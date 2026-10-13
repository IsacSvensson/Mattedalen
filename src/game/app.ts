import type { ContentPack } from '../engine';
import type { PersistStatus, ProgressStore } from '../storage';
import type { GameDeps } from './play';

export interface AppContext {
  root: HTMLElement;
  deps: GameDeps;
  store: ProgressStore;
  pack: ContentPack;
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
  // Move focus to the new screen for keyboard and screen-reader users.
  const focusTarget = view.querySelector<HTMLElement>('[autofocus], h1');
  if (focusTarget) {
    if (!focusTarget.hasAttribute('tabindex') && focusTarget.tagName === 'H1') focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}
