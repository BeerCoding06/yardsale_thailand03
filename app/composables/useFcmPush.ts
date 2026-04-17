import { useNotification } from "./useNotification";
import { cmsEndpointFromPublic } from "~/utils/cmsApiEndpoint";

type FcmUserId = number | string | null | undefined;

type FirebaseMessagingModule = typeof import("firebase/messaging");

/** Safari / WebKit — การขอสิทธิ์แจ้งเตือนต้องมาหลัง user gesture (โดยเฉพาะ iOS) */
function isSafariFamilyForPush(): boolean {
  if (!import.meta.client) return false;
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  if (isIOS) {
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }
  return /^((?!chrome|android|chromium|edg).)*safari/i.test(ua);
}

function pushPermissionShouldWaitForGesture(): boolean {
  if (!import.meta.client) return false;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;
  return isSafariFamilyForPush();
}

export function useFcmPush() {
  const initialized = useState("fcm:initialized", () => false);
  const foregroundBound = useState("fcm:foreground-bound", () => false);
  const latestToken = useState<string | null>("fcm:latest-token", () => null);
  /** รอแตะครั้งแรก (Safari) ก่อนขอสิทธิ์ — ให้ UI แสดงคำแนะนำได้ */
  const awaitingSafariGesture = useState("fcm:awaiting-safari-gesture", () => false);
  const safariGestureHooked = useState("fcm:safari-gesture-hooked", () => false);
  const pendingGestureUserId = useState<FcmUserId | undefined>(
    "fcm:pending-gesture-user-id",
    () => undefined
  );
  const { notify } = useNotification();
  const config = useRuntimeConfig();

  /** POST /api/save-token — laravelApiBase ถ้ามี ไม่งั้นใช้ cmsApiBase (Express ผ่าน proxy เดียวกับ Nuxt) */
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
      updateViaCache: "none",
    });

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
    return token;
  }

  function scheduleSafariGestureInit(userId?: FcmUserId) {
    pendingGestureUserId.value = userId;
    if (safariGestureHooked.value) return;
    safariGestureHooked.value = true;
    awaitingSafariGesture.value = true;

    if (import.meta.dev) {
      console.info(
        "[fcm] Safari: แตะหรือคลิกที่หน้าเว็บครั้งหนึ่งเพื่อขอสิทธิ์แจ้งเตือน (ข้อกำหนดของเบราว์เซอร์)"
      );
    }

    let fired = false;
    const run = () => {
      if (fired) return;
      fired = true;
      window.removeEventListener("pointerdown", run, true);
      window.removeEventListener("click", run, true);
      safariGestureHooked.value = false;
      awaitingSafariGesture.value = false;
      void (async () => {
        try {
          await registerMessagingAndToken(pendingGestureUserId.value);
        } catch (e) {
          console.warn("[fcm] register after gesture failed:", e);
        }
      })();
    };

    window.addEventListener("pointerdown", run, { capture: true, passive: true });
    window.addEventListener("click", run, { capture: true, passive: true });
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
      if (import.meta.dev) {
        console.warn(
          "[fcm] ยังไม่ตั้งค่า Firebase web + VAPID — ตรวจ NUXT_PUBLIC_FIREBASE_* และ NUXT_PUBLIC_FIREBASE_VAPID_KEY"
        );
      }
      return null;
    }

    if (initialized.value && latestToken.value) {
      await saveTokenToBackend(latestToken.value, userId);
      return latestToken.value;
    }

    if (pushPermissionShouldWaitForGesture()) {
      scheduleSafariGestureInit(userId);
      return null;
    }

    try {
      return await registerMessagingAndToken(userId);
    } catch (e) {
      console.warn("[fcm] init failed:", e);
      return null;
    }
  }

  return {
    initFcmPush,
    latestToken: readonly(latestToken),
    awaitingSafariGesture: readonly(awaitingSafariGesture),
  };
}
