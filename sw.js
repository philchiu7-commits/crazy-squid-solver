// Crazy Squid Solver — offline service worker.
// Caches the app shell so it works with no connection once installed.
const CACHE = 'squid-solver-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// The app shell (index.html / navigations) is network-first so a new deploy shows up on the next
// open; everything else (icons, manifest) is cache-first. Offline always falls back to the cache.
// Only successful (2xx) responses are cached, so a host error page can never replace the app.
const cacheShell = () => caches.match('./index.html');
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isShell = event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isShell) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (!resp.ok) return caches.match(event.request).then(c => c || cacheShell()).then(c => c || resp);
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(event.request).then(c => c || cacheShell()))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
