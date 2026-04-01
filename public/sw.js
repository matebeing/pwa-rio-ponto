/* ─────────────────────────────────────────────────────────────────────────────
 * Rio No Ponto — Service Worker (handwritten, Workbox-free for Vite 8 compat)
 *
 * Strategies implemented:
 *   • PRECACHE  – index.html shell (installed at SW install time)
 *   • NetworkFirst  – /api/sppo (bus GPS data, cached for offline)
 *   • CacheFirst    – CARTO map tiles (long-lived)
 *   • StaleWhileRevalidate – GeoJSON / CSV from /public
 * ─────────────────────────────────────────────────────────────────────────── */

const CACHE_VERSION = 'rio-no-ponto-v1';
const TILES_CACHE = 'rio-tiles-v1';
const STATIC_CACHE = 'rio-static-v1';

// Assets to precache during install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate immediately
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_VERSION, TILES_CACHE, STATIC_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ─── Fetch Strategies ───────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) API: bus GPS data → Bypass cache completely
  // The user explicitly requested to only keep buses in memory to avoid SPPO API blocks
  if (url.pathname.startsWith('/api/sppo')) {
    return; // early return so browser fetches normally (no event.respondWith)
  }

  // 2) Map tiles → CacheFirst (7 day expiry)
  if (url.hostname.includes('basemaps.cartocdn.com')) {
    event.respondWith(cacheFirst(request, TILES_CACHE, 7 * 24 * 60 * 60));
    return;
  }

  // 3) Static GeoJSON / CSV from same origin → StaleWhileRevalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.geojson') || url.pathname.endsWith('.csv'))
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // 4) App shell / other same-origin → StaleWhileRevalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, CACHE_VERSION));
    return;
  }
});

// ─── Strategy helpers ───────────────────────────────────────────────────────

// (networkFirst function and API caching was removed to prevent block risks)

/**
 * CacheFirst: serve from cache, only fetch if not cached.
 */
async function cacheFirst(request, cacheName, maxAgeSec) {
  const cached = await caches.match(request);
  if (cached) {
    const cacheTime = Number(cached.headers.get('sw-cache-time') || 0);
    if (!maxAgeSec || Date.now() - cacheTime <= maxAgeSec * 1000) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      const headers = new Headers(clone.headers);
      headers.set('sw-cache-time', String(Date.now()));
      const body = await clone.blob();
      await cache.put(request, new Response(body, { status: clone.status, statusText: clone.statusText, headers }));
    }
    return response;
  } catch {
    if (cached) return cached; // expired but return anyway
    return new Response('', { status: 504 });
  }
}

/**
 * StaleWhileRevalidate: return cache immediately while fetching an update.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}
