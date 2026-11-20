const DEFAULT_NOTIFICATION = {
  title: "rindo",
  body: "Tienes una actualización",
  icon: "/icon-192x192.png",
  badge: "/icon-192x192.png",
};

function readPushPayload(data) {
  if (!data) return {};
  try {
    return data.json();
  } catch {
    return { body: data.text() };
  }
}

self.addEventListener("push", (event) => {
  const payload = { ...DEFAULT_NOTIFICATION, ...readPushPayload(event.data) };
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag ?? "notification",
      requireInteraction: payload.requireInteraction ?? false,
      data: payload.data ?? {},
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === self.registration.scope);
      return open ? open.focus() : self.clients.openWindow("/");
    }),
  );
});
