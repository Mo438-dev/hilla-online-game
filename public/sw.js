const CACHE_NAME = 'hilla-pwa-static-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/pwa-icon?size=192',
  '/pwa-icon?size=512',
  '/pwa-icon?size=512&maskable=1',
  '/pwa-icon?size=180&apple=1'
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

  const isStaticAsset =
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/pwa-icon' ||
    url.pathname.startsWith('/_next/static/');

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
