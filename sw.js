/* Self-destructing service worker.
   Earlier versions cached pages and caused stale loads. This worker now
   clears all caches, unregisters itself, and reloads open pages so no
   stale service worker can keep serving old content. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    } catch (_) {}
  })());
});
