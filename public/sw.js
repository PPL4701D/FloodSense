/**
 * FR-055 (PBI-30) — Service Worker PWA: cache app-shell + fallback offline.
 * Catatan: push notification ditangani sw-push.js terpisah (PBI-16).
 */
const CACHE = 'floodsense-shell-v1';
const SHELL = ['/', '/reports', '/offline.html', '/manifest.json', '/floodsense-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // hanya same-origin

  // Navigasi halaman: network-first, fallback ke cache lalu offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // Aset statis: cache-first
  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res;
      }).catch(() => cached))
    );
  }
});
