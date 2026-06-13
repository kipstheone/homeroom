/* ODO service worker — network-first for the app shell so updates land immediately;
   cache is only the offline fallback. */
const CACHE = "odo-v1.0.0";
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
  /* never intercept API or auth traffic */
  if (url.origin.includes("googleapis") || url.origin.includes("supabase") || url.origin.includes("accounts.google")) return;

  if (url.origin === location.origin) {
    /* NETWORK-FIRST for our own files: fresh code every load, cache only when offline */
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(m => m || caches.match("./index.html")))
    );
  } else if (url.origin.includes("fonts.")) {
    /* cache-first for fonts (they never change) */
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }))
    );
  }
});
