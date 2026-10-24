// NutriLens Service Worker - Passthrough with Cache Purge
// Avoids caching stale Next.js chunk hashes that break client-side touch events and hydration.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Explicitly do not hijack or block Next.js JS chunks, assets, or API requests
self.addEventListener('fetch', (event) => {
  // Let browser handle all requests directly via network
  return;
});
