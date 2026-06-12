/* Homeroom service worker — cache-first for the app shell, network for APIs */
const CACHE = "homeroom-v3";
const SHELL = ["./", "./index.html", "./app.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  /* never cache API or auth traffic */
  if (url.origin.includes("googleapis") || url.origin.includes("supabase") || url.origin.includes("accounts.google")) return;
  /* stale-while-revalidate for same-origin shell + fonts */
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(resp => {
        if (resp && resp.ok && (url.origin === location.origin || url.origin.includes("fonts."))) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
