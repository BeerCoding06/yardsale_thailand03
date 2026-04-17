/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey") || "",
  authDomain: params.get("authDomain") || "",
  projectId: params.get("projectId") || "",
  storageBucket: params.get("storageBucket") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || "",
};

const hasConfig = Object.values(firebaseConfig).every((value) => !!String(value).trim());

if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || "New notification";
    const body = payload?.notification?.body || "";
    const image =
      payload?.notification?.image ||
      payload?.notification?.imageUrl ||
      payload?.data?.image ||
      "";
    const click_action =
      (payload?.data && payload.data.click_action) ||
      payload?.fcmOptions?.link ||
      "";

    const options = {
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      image: image || undefined,
      data: {
        ...(payload?.data && typeof payload.data === "object" ? payload.data : {}),
        click_action: String(click_action || ""),
      },
      tag: payload?.data?.tag || "yardsale-fcm",
    };

    self.registration.showNotification(title, options);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.click_action || d.url || "/";
  const target = typeof url === "string" && url.trim() ? url.trim() : "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const c of clientList) {
          try {
            if (c.url === target && "focus" in c) return c.focus();
          } catch {
            /* ignore */
          }
        }
        if (clients.openWindow) return clients.openWindow(target);
      })
  );
});
