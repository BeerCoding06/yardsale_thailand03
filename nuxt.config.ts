// nuxt.config.ts
import pkg from "./package.json";

export default defineNuxtConfig({
  /**
   * ไม่ใช่ `.nuxt` (มักชน Docker root) และไม่ใส่ใน node_modules — พอร์ต Vite `#build/*` กับ pnpm จะพัง
   * ถ้า EACCES: sudo chown -R "$(whoami)" .yardsale-nuxt
   */
  buildDir: ".yardsale-nuxt",
  ssr: false,
  devtools: { enabled: false },

  modules: [
    "@vueuse/nuxt",
    "@nuxt/ui",
    "@nuxt/image",
    "notivue/nuxt",
    "@nuxtjs/i18n",
  ],

  i18n: {
    defaultLocale: "th",
    /** คีย์ที่ไม่มีใน th-TH จะดึงจาก en */
    fallbackLocale: "en",
    strategy: "prefix_except_default",
    langDir: "locales",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: false, // Disable automatic redirects - let users navigate manually
      alwaysRedirect: false, // Don't always redirect - preserve current route
    },
    locales: [
      { code: "th", iso: "th-TH", file: "th-TH.json", name: "🇹🇭 ไทย" },
      { code: "en", iso: "en-GB", file: "en-GB.json", name: "🇬🇧 English" },
      {
        code: "nb",
        iso: "nb-NO",
        file: "nb-NO.json",
        name: "🇳🇴 Norsk (Bokmål)",
      },
      { code: "nl", iso: "nl-NL", file: "nl-NL.json", name: "🇳🇱 Nederlands" },
      { code: "de", iso: "de-DE", file: "de-DE.json", name: "🇩🇪 Deutsch" },
    ],
  },

  notivue: {
    position: "top-center",
    limit: 3,
    notifications: { global: { duration: 3000 } },
  },

  css: [
    "~/assets/css/main.css",
    "notivue/notification.css", 
    "notivue/animations.css"
  ],

  runtimeConfig: {
    baseUrl: process.env.BASE_URL || (process.env.DOCKER_BUILD === 'true' ? "http://localhost:8000" : "http://www.yardsaleth.com"),
    /**
     * Server-only: Nitro proxy `/yardsale-api` + `/uploads` → Express
     * ใน Docker Compose ชื่อ service มักเป็น `backend` — override ได้ด้วย NUXT_YARDSALE_PROXY_TARGET
     */
    yardsaleProxyTarget:
      process.env.NUXT_YARDSALE_PROXY_TARGET ||
      (process.env.DOCKER_BUILD === "true"
        ? "http://backend:4000"
        : "http://127.0.0.1:4000"),
    public: {
      version: pkg.version,
      baseUrl: process.env.BASE_URL || 'https://www.yardsaleth.com',
      /** Yardsale Express API base (e.g. http://localhost:4000/api) — ว่าง = ใช้ mock /api ในเบราว์เซอร์ */
      cmsApiBase: process.env.NUXT_PUBLIC_CMS_API_BASE || "",
      /** โหลดรูปสินค้าแบบ path สัมพัทธ์ (/uploads/...) เมื่อ cmsApiBase เป็น /yardsale-api */
      yardsaleBackendOrigin: process.env.NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN || "",
      /** หน้าโอนเงิน: ข้อความเลขบัญชีร้าน (หลายบรรทัดได้) — ว่าง = ใช้ข้อความจาก i18n */
      storeBankTransferInfo: process.env.NUXT_PUBLIC_STORE_BANK_TRANSFER_INFO || "",
      /** รูป Thai QR / PromptPay บนหน้าโอน — ค่าเริ่มต้นไฟล์ใน public/images */
      promptpayQrImageUrl:
        process.env.NUXT_PUBLIC_PROMPTPAY_QR_URL || "/images/promptpay-qr.png",
      /** เลขพร้อมเพย์ / เลขนิติบุคคล (ไม่มีช่องว่าง) — ถ้ามีจะสร้าง QR แบบไดนามิกแทนรูปคงที่ */
      promptpayId: process.env.NUXT_PUBLIC_PROMPTPAY_ID || "",
      /** Laravel API สำหรับบันทึก FCM token และยิงแจ้งเตือน */
      laravelApiBase: process.env.NUXT_PUBLIC_LARAVEL_API_BASE || "",
      /** Firebase Web Config (FCM) */
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || "",
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || "",
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
      firebaseMessagingSenderId:
        process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || "",
      firebaseVapidKey: process.env.NUXT_PUBLIC_FIREBASE_VAPID_KEY || "",
      /**
       * true = ฝังยอดใน QR (โหมด EMV dynamic / POI 12) — แอปธนาคารบางตัวสแกนไม่ได้
       * ถ้าสแกนจ่ายไม่ผ่าน ให้ปิดตัวนี้ (ค่าเริ่มต้น false) แล้วให้ลูกค้าใส่ยอดเองหลังสแกน หรือโอนด้วยเลขพร้อมเพย์
       */
      promptpayQrIncludeAmount:
        process.env.NUXT_PUBLIC_PROMPTPAY_QR_INCLUDE_AMOUNT === "true",
    },
  },

  routeRules: {
    "/logo.png": {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    },
    "/images/**": {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    },
    // หน้าแรก SSR เพื่อให้ browser ค้นพบ LCP image ได้ตั้งแต่ HTML แรก
    "/": { ssr: true, prerender: false },
    "/en": { ssr: true, prerender: false },
    "/nb": { ssr: true, prerender: false },
    "/nl": { ssr: true, prerender: false },
    "/de": { ssr: true, prerender: false },
    "/categories": { ssr: true, prerender: false },
    "/favorites": { ssr: true, prerender: false },
    // Dynamic routes - use SSR instead of prerender to avoid payload file issues
    "/product/**": { ssr: true, prerender: false },
    "/order/**": { prerender: false, ssr: false }, // Client-side only
    "/my-orders": { prerender: false, ssr: false }, // Client-side only
    "/my-products": { prerender: false, ssr: false }, // Client-side only
    "/seller-orders": { prerender: false, ssr: false }, // Client-side only
    "/profile": { prerender: false, ssr: false }, // Client-side only
    "/create-product": { prerender: false, ssr: false }, // Client-side only
    "/edit-product/**": { prerender: false, ssr: false }, // Client-side only
    "/login": { ssr: true, prerender: false },
    "/register-user": { ssr: true, prerender: false },
    "/payment-successful": { prerender: false, ssr: false }, // Client-side only
    "/checkout/payment": { prerender: false, ssr: false },
    "/admin/**": { prerender: false, ssr: false },
  },

  nitro: {
    compressPublicAssets: true,
    prerender: {
      routes: [],
      crawlLinks: false,
    },
  },
  
  typescript: {
    typeCheck: false, // Disable type checking during build to avoid errors
  },

  compatibilityDate: "2024-08-03",

  /**
   * IPX (/_ipx/) ดึงรูปโดเมนภายนอกฝั่งเซิร์ฟเวอร์ — Cloudflare/bot มักทำให้ 500
   * รูป https:// ในแอปใช้คอมโพเนนต์ StorefrontImg (แท็ก img ตรง ๆ) แทน NuxtImg
   */
  image: {
    domains: (process.env.NUXT_IMAGE_DOMAINS || "127.0.0.1,localhost")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  vite: {
    /** หลีกเลี่ยง `node_modules/.cache` ที่อาจเป็น root-owned จาก Docker */
    cacheDir: ".vite-cache",
    server: {
      /** Dev: NUXT_PUBLIC_CMS_API_BASE=/yardsale-api → เบราว์เซอร์ยิงพอร์ตเดียวกับ Nuxt แล้วโยงไป Express (เลี่ยง CORS / Failed to fetch) */
      proxy: {
        "/yardsale-api": {
          target: process.env.NUXT_YARDSALE_PROXY_TARGET || "http://127.0.0.1:4000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/yardsale-api/, "/api"),
        },
        /** dev: เปิด /uploads/... บนพอร์ตเดียวกับ Nuxt (รูปโดยตรงแบบไม่ผ่าน IPX) */
        "/uploads": {
          target: process.env.NUXT_YARDSALE_PROXY_TARGET || "http://127.0.0.1:4000",
          changeOrigin: true,
        },
      },
    },
  },
});
