/* ============================================================
   Borealis Converter — Service Worker
   App-shell precache + runtime caching so the app works offline.
   ============================================================ */

const VERSION = 'v1';
const SHELL_CACHE = `borealis-converter-shell-${VERSION}`;
const RUNTIME_CACHE = `borealis-converter-runtime-${VERSION}`;

// Same-origin app shell — cached up front so the app opens offline.
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Tolerate an individual asset failing so install never breaks.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache the live exchange-rate API — always try the network so rates
  // stay fresh; the app has its own baked-in fallback table if this fails.
  if (url.hostname.endsWith('frankfurter.dev') || url.hostname.endsWith('frankfurter.app')) {
    return; // let the browser handle it; app code catches failures
  }

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true })
          .then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Everything else (same-origin assets + CDN scripts/fonts):
  // cache-first, then network, and populate the runtime cache on the way.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Cache successful and opaque (cross-origin CDN) responses alike.
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
    })
  );
});
