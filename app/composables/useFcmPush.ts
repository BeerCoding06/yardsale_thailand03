import { useNotification } from "./useNotification";
import { cmsEndpointFromPublic } from "~/utils/cmsApiEndpoint";
import {
  iosFcmBlockedOutsideStandalone,
  isDesktopSafari,
  isIOSDevice,
  isStandaloneDisplayMode,
} from "~/utils/fcmIosContext";

type FcmUserId = number | string | null | undefined;

type FirebaseMessagingModule = typeof import("firebase/messaging");

const FCM_GESTURE_DISMISS_SESSION_KEY = "yardsale_fcm_gesture_dismissed";

function isFcmGestureDismissedThisSession(): boolean {
  if (!import.meta.client) return false;
  try {
    return sessionStorage.getItem(FCM_GESTURE_DISMISS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setFcmGestureDismissedThisSession() {
  if (!import.meta.client) return;
  try {
    sessionStorage.setItem(FCM_GESTURE_DISMISS_SESSION_KEY, "1");
  } catch {
    /* private mode */
  }
}

function clearFcmGestureDismissedThisSession() {
  if (!import.meta.client) return;
  try {
    sessionStorage.removeItem(FCM_GESTURE_DISMISS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** ขอสิทธิ์แจ้งเตือนหลัง user gesture (Safari เดสก์ท็อป + iOS PWA) */
function pushPermissionShouldWaitForGesture(): boolean {
  if (!import.meta.client) return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;
  if (isDesktopSafari()) return true;
  if (isIOSDevice() && isStandaloneDisplayMode()) return true;
  return false;
}

export function useFcmPush() {
  const initialized = useState("fcm:initialized", () => false);
  const foregroundBound = useState("fcm:foreground-bound", () => false);
  const latestToken = useState<string | null>("fcm:latest-token", () => null);
  const awaitingSafariGesture = useState("fcm:awaiting-safari-gesture", () => false);
  const pendingGestureUserId = useState<FcmUserId | undefined>(
    "fcm:pending-gesture-user-id",
    () => undefined
  );
  /** iOS แท็บเบราว์เซอร์ — แสดง UI แนะนำ Add to Home Screen */
  const installBannerReason = useState<"ios" | null>("fcm:install-banner-reason", () => null);

  const { notify } = useNotification();
  const config = useRuntimeConfig();

  function resolveFcmSaveTokenUrl(): string {
    const pub = config.public as {
      laravelApiBase?: string;
      cmsApiBase?: string;
      baseUrl?: string;
    };
    const laravel = String(pub.laravelApiBase || "").trim();
    if (laravel) {
      const origin = laravel.replace(/\/+$/, "").replace(/\/api\/?$/i, "");
      return `${origin}/api/save-token`;
    }
    const cms = String(pub.cmsApiBase || "").trim();
    if (!cms || !import.meta.client) return "";
    return cmsEndpointFromPublic(pub, "save-token", true);
  }

  async function saveTokenToBackend(token: string, userId?: FcmUserId) {
    const url = resolveFcmSaveTokenUrl();
    if (!url) {
      if (import.meta.dev) {
        console.warn(
          "[fcm] ไม่มี URL บันทึก token — ตั้ง NUXT_PUBLIC_LARAVEL_API_BASE หรือ NUXT_PUBLIC_CMS_API_BASE"
        );
      }
      return;
    }

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

    try {
      await $fetch(url, {
        method: "POST",
        body: payload,
        headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
      });
    } catch (e) {
      console.warn("[fcm] save-token failed:", e);
    }
  }

  async function registerMessagingAndToken(userId?: FcmUserId) {
    if (iosFcmBlockedOutsideStandalone()) {
      if (import.meta.dev) {
        console.info("[fcm] ข้ามลงทะเบียน: บน iOS ต้องเปิดจากแอปหน้าจอโฮม (PWA)");
      }
      return null;
    }

    const firebaseConfig = {
      apiKey: String(config.public.firebaseApiKey || ""),
      authDomain: String(config.public.firebaseAuthDomain || ""),
      projectId: String(config.public.firebaseProjectId || ""),
      storageBucket: String(config.public.firebaseStorageBucket || ""),
      messagingSenderId: String(config.public.firebaseMessagingSenderId || ""),
      appId: String(config.public.firebaseAppId || ""),
    };
    const vapidKey = String(config.public.firebaseVapidKey || "");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const [{ getApps, initializeApp }, messagingModule] = await Promise.all([
      import("firebase/app"),
      import("firebase/messaging"),
    ]);
    const messagingApi = messagingModule as FirebaseMessagingModule;
    const supported = await messagingApi.isSupported();
    if (!supported) {
      if (import.meta.dev) console.warn("[fcm] Firebase messaging ไม่รองรับในเบราว์เซอร์นี้");
      return null;
    }

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

    const swUrl = new URL("/firebase-messaging-sw.js", window.location.origin);
    Object.entries(firebaseConfig).forEach(([key, value]) => {
      swUrl.searchParams.set(key, value);
    });
    const registration = await navigator.serviceWorker.register(swUrl.toString(), {
      type: "classic",
      scope: "/",
      updateViaCache: "none",
    });
    await registration.update?.();

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
        const link =
          (payload.data &&
            typeof payload.data === "object" &&
            (payload.data as { click_action?: string }).click_action) ||
          "";
        const text =
          body && link
            ? `${title}: ${body}\n${link}`
            : body
              ? `${title}: ${body}`
              : link
                ? `${title}\n${link}`
                : title;
        notify(text, "info");
      });
      foregroundBound.value = true;
    }

    initialized.value = true;
    installBannerReason.value = null;
    return token;
  }

  /** Safari / iOS PWA ต้องขอสิทธิ์หลัง user gesture — แสดงปุ่มใน `FcmGestureHint` */
  function schedulePermissionAfterGesture(userId?: FcmUserId) {
    pendingGestureUserId.value = userId;
    awaitingSafariGesture.value = true;
  }

  function dismissPushPermissionPrompt() {
    awaitingSafariGesture.value = false;
    setFcmGestureDismissedThisSession();
  }

  /**
   * เรียกจากปุ่มใน UI (iOS PWA / Safari) — ขอสิทธิ์และลงทะเบียน FCM ทันทีหลัง user gesture
   */
  async function enablePushFromUserGesture(userId?: FcmUserId) {
    if (iosFcmBlockedOutsideStandalone()) return null;
    clearFcmGestureDismissedThisSession();
    awaitingSafariGesture.value = false;
    const resolved = userId ?? pendingGestureUserId.value;
    return registerMessagingAndToken(resolved);
  }

  async function initFcmPush(userId?: FcmUserId) {
    if (!import.meta.client) return null;
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

    if (!hasConfig) {
      installBannerReason.value = null;
      if (import.meta.dev) {
        console.warn(
          "[fcm] ยังไม่ตั้งค่า Firebase web + VAPID — ตรวจ NUXT_PUBLIC_FIREBASE_* และ NUXT_PUBLIC_FIREBASE_VAPID_KEY"
        );
      }
      return null;
    }

    if (iosFcmBlockedOutsideStandalone()) {
      installBannerReason.value = "ios";
      if (import.meta.dev) {
        console.info(
          "[fcm] iOS: เปิดจากแอปหน้าจอโฮมแล้วค่อยลงทะเบียนแจ้งเตือน (ดูคำแนะนำบนหน้าจอ)"
        );
      }
      return null;
    }

    installBannerReason.value = null;

    if (initialized.value && latestToken.value) {
      await saveTokenToBackend(latestToken.value, userId);
      return latestToken.value;
    }

    if (pushPermissionShouldWaitForGesture()) {
      if (!isFcmGestureDismissedThisSession()) {
        schedulePermissionAfterGesture(userId);
      }
      return null;
    }

    try {
      return await registerMessagingAndToken(userId);
    } catch (e) {
      console.warn("[fcm] init failed:", e);
      return null;
    }
  }

  const iosNeedsHomeScreen = computed(
    () => installBannerReason.value === "ios"
  );

  return {
    initFcmPush,
    enablePushFromUserGesture,
    dismissPushPermissionPrompt,
    latestToken: readonly(latestToken),
    awaitingSafariGesture: readonly(awaitingSafariGesture),
    installBannerReason: readonly(installBannerReason),
    iosNeedsHomeScreen,
    isIOSDevice: () => (import.meta.client ? isIOSDevice() : false),
    isStandaloneDisplayMode: () =>
      import.meta.client ? isStandaloneDisplayMode() : false,
  };
}
