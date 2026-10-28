// v17 legacy cleanup only: no fetch interception or new caches.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith("cloud-candy-vocab-")).map(k => caches.delete(k)));
        await self.registration.unregister();
    })());
});
