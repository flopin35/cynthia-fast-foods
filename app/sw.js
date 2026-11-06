// Cynthia Orders: lets the app open without a connection.
// Orders themselves are kept on the device by Firebase.
const CACHE = "cynthia-orders-v1";
const SHELL = ["/app/", "/app/manifest.webmanifest", "/app/icons/icon-192.png", "/app/icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname.includes("firestore.googleapis.com") || u.hostname.includes("identitytoolkit") || u.hostname.includes("securetoken")) return;
  // App page: network first so updates show straight away, cached copy when offline
  if (u.origin === location.origin && (u.pathname === "/app/" || u.pathname === "/app/index.html")) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("/app/", copy)); return r; }).catch(() => caches.match("/app/")));
    return;
  }
  // Firebase code, fonts and icons: cached copy first, refreshed in the background
  if (u.hostname === "www.gstatic.com" || u.hostname.endsWith("fonts.googleapis.com") || u.hostname.endsWith("fonts.gstatic.com") || (u.origin === location.origin && u.pathname.startsWith("/app/"))) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
