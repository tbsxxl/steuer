/* Offline-Unterstützung: Die App lädt nach dem ersten Besuch auch ohne Netz.
   HTML/JS/CSS: zuerst Netz (Updates sofort sichtbar), bei Offline aus dem Cache.
   Schriften und Icons: zuerst Cache (ändern sich nie). */
const CACHE = "steuerkurs-v4";
const SHELL = [
  "/", "/css/app.css", "/js/theme.js", "/js/app.js", "/js/data.js", "/js/trainer.js",
  "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png",
  "/fonts/plex-sans-latin.woff2", "/fonts/newsreader-latin.woff2", "/fonts/plex-mono-400-latin.woff2", "/fonts/plex-mono-600-latin.woff2",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  if (url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("/") : Response.error())))
  );
});
