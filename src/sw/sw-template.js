/* Service worker for Mattedalen.
 *
 * Caches only the app's own static files (the build output) so the app works
 * fully offline after the first visit. Nothing else is fetched or cached:
 * all user data lives in IndexedDB.
 *
 * This file is a template: the build fills in the precache list and the
 * version (see swPlugin in vite.config.ts).
 */
const PRECACHE = __PRECACHE__;
const VERSION = __VERSION__;
// Gångerträdgården lives on the same origin and deletes every cache named
// `gangertradgarden-*` but its own, so this prefix must stay different. The
// test version has its own prefix (see vite.config.ts).
const CACHE_PREFIX = __CACHE_PREFIX__;
const CACHE = `${CACHE_PREFIX}${VERSION}`;
const SHELL = './index.html';
// The test version lives in ./test/ with its own worker (docs/PLAN-TESTVERSION.md):
// this one leaves it alone, also before that worker is installed. Its address
// without the last slash would otherwise get this app's shell, with this app's
// children, so it is sent on to ./test/.
const TEST_VERSION = new URL('./test/', self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((path) => new Request(path, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

/** The page asks a waiting worker to take over when the user chooses to update. */
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === TEST_VERSION.pathname.slice(0, -1)) {
    if (request.mode === 'navigate') event.respondWith(Response.redirect(TEST_VERSION.href, 301));
    return;
  }
  if (url.pathname.startsWith(TEST_VERSION.pathname)) return;

  if (request.mode === 'navigate') {
    // Single-page app: a navigation gets the cached shell, unless it opens one
    // of the app's own files (e.g. the licence texts in a new tab).
    event.respondWith(
      caches
        .match(request, { cacheName: CACHE, ignoreSearch: true })
        .then((file) => file ?? caches.match(SHELL, { cacheName: CACHE }))
        .then((cached) => cached ?? fetch(request)),
    );
    return;
  }
  event.respondWith(
    caches.match(request, { cacheName: CACHE, ignoreSearch: true }).then((cached) => cached ?? fetch(request)),
  );
});
