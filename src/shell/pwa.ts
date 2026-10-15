import { h, s } from './dom';
import { icon } from './components/icons';

// --- service worker -------------------------------------------------------

let registration: ServiceWorkerRegistration | null = null;
let waiting: ServiceWorker | null = null;
/** A game is on screen: never reload in the middle of it. */
let busy = false;
let reloadWhenFree = false;
const updateListeners = new Set<() => void>();

/** Pause after the page has loaded before a waiting version is started. */
const SETTLE_MS = 1000;
/** How often an open app looks for a new version (besides at start and when it comes back to the front). */
const UPDATE_CHECK_MS = 30 * 60_000;

/** Build of the running app, e.g. "2026-10-14 · 8ba0bb2" (set by vite.config.ts). */
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'utveckling';

/**
 * Registers the service worker (production builds only).
 *
 * A new version is downloaded in the background and then:
 * - taken into use right away if it was already waiting when the app started
 *   (an installed app is often never fully closed, so it would wait forever),
 * - otherwise offered with an update button on every screen except during a
 *   game, so files are never swapped in the middle of a session.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let hadController = !!navigator.serviceWorker.controller;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    registration = reg;
    // The first install takes control without a reload; later versions reload
    // the page (also in a page that was opened before the first install).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController && !waiting) {
        hadController = true;
        return;
      }
      if (busy) reloadWhenFree = true;
      else location.reload();
    });
    if (reg.waiting && hadController && !busy) {
      // Downloaded during an earlier visit: start the new version now, before
      // anything is played. Asked a moment after the page has loaded: asked
      // while the old version is still starting up and serving the page,
      // Chromium could leave the new one waiting for good (seen in CI).
      const worker = reg.waiting;
      await pageLoaded();
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
      if (!busy) {
        worker.postMessage('skipWaiting');
        return;
      }
      // A game started meanwhile: offer the update afterwards instead.
    }
    const track = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        // Only an update (not the first install) needs the user's go-ahead.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waiting = worker;
          notify();
        }
      };
      check();
      worker.addEventListener('statechange', check);
    };
    track(reg.waiting);
    reg.addEventListener('updatefound', () => track(reg.installing));
    const lookForUpdate = () => void reg.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') lookForUpdate();
    });
    window.addEventListener('online', lookForUpdate);
    setInterval(() => {
      if (document.visibilityState === 'visible') lookForUpdate();
    }, UPDATE_CHECK_MS);
  } catch {
    // Offline support is a bonus; the app still works online without it.
  }
}

function pageLoaded(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
}

function notify(): void {
  for (const listener of updateListeners) listener();
  renderUpdateBar();
}

export function updateReady(): boolean {
  return waiting !== null;
}

export function onUpdateReady(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => updateListeners.delete(listener);
}

export function applyUpdate(): void {
  if (!waiting) return;
  waiting.postMessage('skipWaiting');
}

/** Called for every new screen: games are "busy", everything else may update. */
export function setScreenBusy(isBusy: boolean): void {
  busy = isBusy;
  if (!busy && reloadWhenFree) {
    location.reload();
    return;
  }
  renderUpdateBar();
}

export type UpdateCheck = 'updating' | 'latest' | 'unavailable';

/** "Sök efter uppdatering" in the parent view: looks now and starts a new version at once. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const reg = registration;
  if (!reg) return 'unavailable';
  try {
    await reg.update();
  } catch {
    return 'unavailable';
  }
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return 'latest';
  if (worker.state === 'installing') {
    await new Promise<void>((resolve) => {
      const done = () => worker.state !== 'installing' && resolve();
      worker.addEventListener('statechange', done);
    });
  }
  if (!reg.waiting) return 'latest';
  waiting = reg.waiting;
  applyUpdate();
  return 'updating';
}

/** A small, fixed "new version" button, shown on every screen except during a game. */
function renderUpdateBar(): void {
  let bar = document.getElementById('update-bar');
  const visible = waiting !== null && !busy;
  if (!visible) {
    bar?.remove();
    return;
  }
  if (bar) return;
  bar = h(
    'div',
    { id: 'update-bar', class: 'update-bar', role: 'status' },
    h('button', { class: 'soft-button small', type: 'button', onclick: () => applyUpdate() }, icon('refresh'), 'Ny version finns – uppdatera'),
  );
  document.body.append(bar);
}

// --- installation ---------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/** Chrome/Edge on Android and desktop offer their own install dialog; keep the event for our button. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => (deferredPrompt = null));
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(ua = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints): Platform {
  // iPadOS reports itself as a Mac, but has a touch screen.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

/** Step-by-step instructions for adding the app to the home screen. */
export function installGuide(platform = detectPlatform()): HTMLElement {
  if (isStandalone()) return h('p', { class: 'install-done' }, icon('check'), 'Appen är redan tillagd på hemskärmen.');

  const button = deferredPrompt
    ? h(
        'button',
        {
          class: 'big-button',
          type: 'button',
          onclick: async () => {
            if (await promptInstall()) button?.replaceWith(h('p', { class: 'install-done' }, icon('check'), 'Appen installeras.'));
          },
        },
        'Installera appen',
      )
    : null;

  const steps =
    platform === 'ios'
      ? [
          h('li', null, 'Öppna sidan i ', h('strong', null, 'Safari'), '.'),
          h('li', null, 'Tryck på ', h('strong', null, 'Dela'), ' ', shareIcon(), ' (fyrkanten med en pil uppåt).'),
          h('li', null, 'Bläddra ner och välj ', h('strong', null, 'Lägg till på hemskärmen'), '.'),
          h('li', null, 'Tryck på ', h('strong', null, 'Lägg till'), '. Starta sedan appen från ikonen.'),
        ]
      : platform === 'android'
        ? [
            h('li', null, 'Öppna sidan i ', h('strong', null, 'Chrome'), '.'),
            h('li', null, 'Tryck på menyn ', h('strong', null, '⋮'), ' uppe till höger.'),
            h('li', null, 'Välj ', h('strong', null, 'Installera app'), ' eller ', h('strong', null, 'Lägg till på startskärmen'), '.'),
          ]
        : [
            h('li', null, 'I Chrome eller Edge: klicka på installationsikonen i adressfältet, eller välj ', h('strong', null, 'Installera Mattedalen'), ' i menyn.'),
            h('li', null, 'I Safari på Mac: välj ', h('strong', null, 'Arkiv → Lägg till i Dock'), '.'),
          ];

  return h(
    'div',
    { class: 'install-guide' },
    button,
    h('ol', { class: 'install-steps' }, steps),
    h(
      'p',
      { class: 'muted' },
      'Som installerad app startar spelet i helskärm, fungerar helt utan internet och webbläsaren raderar inte barnens framsteg lika lätt.',
    ),
  );
}

/** The iOS share symbol: a box with an arrow pointing up. */
function shareIcon(): SVGSVGElement {
  return s(
    'svg',
    { class: 'ios-share', viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': 'true' },
    s('path', { d: 'M8 9H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10a1 1 0 0 0-1-1h-2', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }),
    s('path', { d: 'M12 15V3M8 7l4-4 4 4', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  );
}
