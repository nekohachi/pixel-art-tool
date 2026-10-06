/* Network-first service worker.
   Purpose: make the app installable (Add to Home Screen → full-screen app)
   WITHOUT ever serving stale content while online — the cache-first worker we
   used before caused stale loads. Here every request goes to the network first;
   the cache is only a fallback used when the device is offline. */
const RT = 'pxeditor-runtime';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // drop any old precache buckets from earlier versions
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== RT).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   // let Firebase REST/SSE go straight to the network
  e.respondWith((async () => {
    try {
      // network first, and revalidate with the server (ETag) instead of trusting the HTTP cache,
      // so a new deploy shows up on the next load instead of up to max-age later
      const res = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' });
      if (res && res.ok && new URL(req.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(RT).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (_) {
      const cached = await caches.match(req);        // offline → last-seen copy
      if (cached) return cached;
      throw _;
    }
  })());
});
