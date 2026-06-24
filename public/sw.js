// ExpiryGuard service worker — handles Web Push notifications.
// Scope: "/" (served from the site root by Next.js public/).

self.addEventListener("install", () => {
  // Activate this worker immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A push arrives from the server (even when the app/tab is closed).
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "ExpiryGuard", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "ExpiryGuard";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: payload.tag || "expiryguard-alert",
    renotify: true,
    data: { url: payload.url || "/" },
    vibrate: [120, 60, 120]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an open tab, or opens the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});
