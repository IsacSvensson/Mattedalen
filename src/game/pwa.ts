import { h, s } from './dom';
import { icon } from './components/icons';

// --- service worker -------------------------------------------------------

let waiting: ServiceWorker | null = null;
const updateListeners = new Set<() => void>();

/**
 * Registers the service worker (production builds only). A new version is
 * installed in the background and waits; the app offers it on the start
 * screen instead of swapping files in the middle of a session.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    const track = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const check = () => {
        // Only an update (not the first install) needs the user's go-ahead.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waiting = worker;
          for (const listener of updateListeners) listener();
        }
      };
      check();
      worker.addEventListener('statechange', check);
    };
    track(reg.waiting);
    reg.addEventListener('updatefound', () => track(reg.installing));
    // Look for updates when the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
    });
  } catch {
    // Offline support is a bonus; the app still works online without it.
  }
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
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage('skipWaiting');
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
            h('li', null, 'I Chrome eller Edge: klicka på installationsikonen i adressfältet, eller välj ', h('strong', null, 'Installera Gångerträdgården'), ' i menyn.'),
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
