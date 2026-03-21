// nuxt.config.ts
import pkg from "./package.json";

// Check if we're generating static site or building for Docker
const isStaticGeneration = process.env.NUXT_GENERATE === 'true' || process.argv.includes('generate');
const isDockerBuild = process.env.DOCKER_BUILD === 'true';

export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    "@vueuse/nuxt",
    "@nuxt/ui",
    "@nuxt/image",
    "notivue/nuxt",
    // Only include NuxtHub if not generating static site and not building for Docker
    ...(isStaticGeneration || isDockerBuild ? [] : ["@nuxthub/core"]),
    "@nuxtjs/i18n",
  ],

  i18n: {
    defaultLocale: "en",
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
      { code: "en", iso: "en-GB", file: "en-GB.json", name: "🇬🇧 English" },
      { code: "th", iso: "th-TH", file: "th-TH.json", name: "🇹🇭 ไทย" },
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

  // Only configure hub if not generating static site and not building for Docker
  ...(isStaticGeneration || isDockerBuild ? {} : {
    hub: {
      cache: true,
    },
  }),

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
    // WordPress/CMS - can be set via .env file
    wpBaseUrl: process.env.WP_BASE_URL || 'https://cms.yardsaleth.com',
    wpProxyPublicUrl: process.env.WP_PROXY_PUBLIC_URL || 'https://cms.yardsaleth.com',
    wpMediaUrl: process.env.WP_MEDIA_URL || process.env.WP_PROXY_PUBLIC_URL || 'https://cms.yardsaleth.com',
    wpBasicAuth: process.env.WP_BASIC_AUTH || '',
    wpConsumerKey: process.env.WP_CONSUMER_KEY || '',
    wpConsumerSecret: process.env.WP_CONSUMER_SECRET || '',
    omiseSecretKey: process.env.OMISE_SECRET_KEY || '',
    omisePublicKey: process.env.OMISE_PUBLIC_KEY || '',
    omiseWebhookSecret: process.env.OMISE_WEBHOOK_SECRET || '',
    /** เรียก WordPress `order-paid` หลัง PayPal — ตั้ง `ORDER_PAID_SECRET`; fallback build-time: `OMISE_ORDER_PAID_SECRET` (ชื่อเก่า) */
    orderPaidSecret: process.env.ORDER_PAID_SECRET || process.env.OMISE_ORDER_PAID_SECRET || '',
    paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    paypalEnvironment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    /**
     * คำนวณสต็อกหน้าร้าน = สต็อก WC − จำนวนที่ชำระแล้ว (ออเดอร์ processing/completed/on-hold)
     * ตั้ง NUXT_STOCK_SUBTRACT_PAID=false ถ้า WooCommerce ลดสต็อกตอนชำระเงินอยู่แล้ว (กันหักซ้ำ)
     */
    stockSubtractPaidOrders: process.env.NUXT_STOCK_SUBTRACT_PAID !== 'false',
    public: {
      version: pkg.version,
      baseUrl: process.env.BASE_URL || 'https://www.yardsaleth.com',
      paypalClientId: process.env.NUXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '',
      /** ต้องตรงกับสกุลใน PayPal SDK + order บน server (ค่าเริ่ม USD ตาม SDK URL มาตรฐาน) */
      paypalCheckoutCurrency:
        process.env.NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY || 'USD',
    },
  },

  routeRules: {
    // หน้าแรก: client-only เพื่อหลีกเลี่ยง 500 ตอนยังไม่ login (ไม่รัน logic ฝั่ง server)
    "/": { ssr: false, prerender: false },
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
    "/payment-promptpay": { prerender: false, ssr: false }, // Client-side only
    "/payment-paypal": { prerender: false, ssr: false },
  },

  nitro: {
    prerender: {
      routes: [],
      crawlLinks: false,
    },
  },
  
  typescript: {
    typeCheck: false, // Disable type checking during build to avoid errors
  },

  compatibilityDate: "2024-08-03",
});
