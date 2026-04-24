// Service Worker para Web Push Notifications — Cuadrante
// Este archivo DEBE estar en la raíz pública para tener scope sobre toda la app.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "🎯 Cuadrante",
      body: event.data.text(),
    };
  }

  const title = payload.title || "🎯 Alerta Cuadrante";
  const options = {
    body: payload.body || "Nueva alerta detectada",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/badge-72.png",
    tag: payload.tag || "cuadrante-alert",
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || "/alertas",
    },
    actions: [
      { action: "open", title: "Ver Alertas" },
      { action: "dismiss", title: "Descartar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/alertas";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una pestaña abierta, enfocarla y navegar
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Si no, abrir una nueva
      return clients.openWindow(targetUrl);
    })
  );
});

// Activación inmediata del SW nuevo
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
