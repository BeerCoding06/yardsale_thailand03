import { useNotification } from "./useNotification";

type FcmUserId = number | string | null | undefined;

type FirebaseMessagingModule = typeof import("firebase/messaging");

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const nextPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${nextPath}`;
}

export function useFcmPush() {
  const initialized = useState("fcm:initialized", () => false);
  const foregroundBound = useState("fcm:foreground-bound", () => false);
  const latestToken = useState<string | null>("fcm:latest-token", () => null);
  const { notify } = useNotification();
  const config = useRuntimeConfig();

  async function saveTokenToBackend(token: string, userId?: FcmUserId) {
    const apiBase = String(config.public.laravelApiBase || "").trim();
    if (!apiBase) return;

    const payload: Record<string, unknown> = {
      token,
      device: "web",
    };
    if (userId != null && userId !== "") {
      payload.user_id = userId;
    }

    const authRaw = import.meta.client ? localStorage.getItem("user") : null;
    let bearerToken = "";
    try {
      bearerToken = authRaw ? JSON.parse(authRaw)?.token || "" : "";
    } catch {
      bearerToken = "";
    }

    await $fetch(buildUrl(apiBase, "/api/save-token"), {
      method: "POST",
      body: payload,
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
    });
  }

  async function initFcmPush(userId?: FcmUserId) {
    if (!import.meta.client || initialized.value) return latestToken.value;
    if (!("serviceWorker" in navigator)) return null;
    if (!window.isSecureContext) return null;

    const firebaseConfig = {
      apiKey: String(config.public.firebaseApiKey || ""),
      authDomain: String(config.public.firebaseAuthDomain || ""),
      projectId: String(config.public.firebaseProjectId || ""),
      storageBucket: String(config.public.firebaseStorageBucket || ""),
      messagingSenderId: String(config.public.firebaseMessagingSenderId || ""),
      appId: String(config.public.firebaseAppId || ""),
    };
    const vapidKey = String(config.public.firebaseVapidKey || "");
    const hasConfig = Object.values(firebaseConfig).every((v) => v.trim()) && !!vapidKey;
    if (!hasConfig) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const [{ getApps, initializeApp }, messagingModule] = await Promise.all([
      import("firebase/app"),
      import("firebase/messaging"),
    ]);
    const messagingApi = messagingModule as FirebaseMessagingModule;
    const supported = await messagingApi.isSupported();
    if (!supported) return null;

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

    const swUrl = new URL("/firebase-messaging-sw.js", window.location.origin);
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      swUrl.searchParams.set(key, value);
    });
    const registration = await navigator.serviceWorker.register(swUrl.toString());

    const messaging = messagingApi.getMessaging(app);
    const token = await messagingApi.getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    latestToken.value = token;
    await saveTokenToBackend(token, userId);

    if (!foregroundBound.value) {
      messagingApi.onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "New notification";
        const body = payload.notification?.body || "";
        notify(body ? `${title}: ${body}` : title, "info");
      });
      foregroundBound.value = true;
    }

    initialized.value = true;
    return token;
  }

  return { initFcmPush, latestToken: readonly(latestToken) };
}
