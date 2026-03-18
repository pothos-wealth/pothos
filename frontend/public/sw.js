const CACHE = "pothos-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)));
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
            )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    // Only intercept same-origin HTML navigation requests, never API calls
    if (e.request.mode !== "navigate" || e.request.url.includes("/api/")) return;

    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
});
