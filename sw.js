const CACHE = "adviento-bmlsciph";
const BASE = ["./", "index.html", "datos.bin", "manifest.webmanifest", "iconos/icono-192.png", "iconos/icono-512.png", "iconos/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (x) { d = {body: e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(d.title || "Calendario de Adviento", {
    body: d.body || "", icon: "iconos/icono-192.png", badge: "iconos/icono-192.png", tag: "adviento-" + (d.dia || "prueba"), data: {url: "./"}
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type: "window", includeUncontrolled: true}).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return clients.openWindow("./");
  }));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    // primero la red (para recibir cambios), y si no hay conexión, lo guardado
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request, {ignoreSearch: true})));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })));
  }
});
