const CACHE_NAME = 'hilla-pwa-static-v2';
const STATIC_ASSETS = [
  '/icons/e2/icon-192.png',
  '/icons/e2/icon-512.png',
  '/icons/e2/icon-maskable-512.png',
  '/icons/e2/apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/admin/analytics')) return;

  // Manifests and icons are left to the network so a new icon set shows up without a stale copy.
  const isStaticAsset = url.pathname.startsWith('/_next/static/');

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
