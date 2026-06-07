/**
 * FR-055 (PBI-30) + FR-033 (PBI-16) — Service Worker tunggal FloodSense.
 * Menangani cache app-shell + fallback offline DAN Web Push (digabung agar
 * tidak saling menimpa di scope '/'; dulu sw-push.js terpisah → konflik).
 */
const CACHE = 'floodsense-shell-v2';
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

// --- FR-033 (PBI-16): Web Push ---
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'FloodSense', {
        body: data.body || 'Notifikasi baru dari FloodSense',
        icon: data.icon || '/floodsense-logo.png',
        badge: '/floodsense-logo.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' },
        actions: [
          { action: 'open', title: 'Buka' },
          { action: 'dismiss', title: 'Tutup' },
        ],
      })
    );
  } catch (err) {
    console.error('Push event error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
