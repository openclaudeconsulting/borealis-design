/* ============================================================
   Roam — service worker.
   Precache the app shell for instant offline launch; runtime-cache
   the CDN libs and the (large) OCR engine on first use so scanning
   works offline afterwards. The live FX API is never cached.
   ============================================================ */

const VERSION = 'v2';
const SHELL_CACHE = `roam-shell-${VERSION}`;
const RUNTIME_CACHE = `roam-runtime-${VERSION}`;

const SHELL_ASSETS = [
  './', './index.html', './app.js', './lens.js', './manifest.webmanifest',
  './lib/convert.js', './lib/parsePrice.js', './lib/units.js', './lib/sizes.js',
  './lib/tips.js', './lib/countries.js', './lib/phrases.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Always hit the network for live rates (app has its own fallback).
  if (url.hostname.endsWith('frankfurter.dev') || url.hostname.endsWith('frankfurter.app')) return;

  // Navigations: network-first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const c = res.clone(); caches.open(SHELL_CACHE).then((k) => k.put('./index.html', c)); return res; })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }).then((h) => h || caches.match('./')))
    );
    return;
  }

  // Everything else (app modules, vendored OCR engine, CDN libs, fonts):
  // cache-first, then network, populating the runtime cache. This is what
  // makes the ~7 MB offline OCR engine persist after the first scan.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
    })
  );
});
