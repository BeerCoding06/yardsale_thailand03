// nuxt.config.ts
import pkg from "./package.json";

// Check if we're generating static site or building for Docker
const isStaticGeneration = process.env.NUXT_GENERATE === 'true' || process.argv.includes('generate');
const isDockerBuild = process.env.DOCKER_BUILD === 'true';

export default defineNuxtConfig({
  devtools: { enabled: false },

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
    strategy: "prefix_except_default",
    langDir: "locales",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
      alwaysRedirect: true,
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
    baseUrl: process.env.BASE_URL || (process.env.DOCKER_BUILD === 'true' ? "http://localhost:8000" : "http://localhost/yardsale_thailand"),
    public: {
      version: pkg.version,
    },
  },

  routeRules: {
    // Prerender static pages
    "/": { prerender: true },
    "/categories": { prerender: true },
    "/favorites": { prerender: true },
    // Dynamic routes - use SSR instead of prerender to avoid payload file issues
    "/product/**": { ssr: true, prerender: false },
    "/order/**": { prerender: false, ssr: false }, // Client-side only
    "/my-orders": { prerender: false, ssr: false }, // Client-side only
    "/my-products": { prerender: false, ssr: false }, // Client-side only
    "/seller-orders": { prerender: false, ssr: false }, // Client-side only
    "/profile": { prerender: false, ssr: false }, // Client-side only
    "/create-product": { prerender: false, ssr: false }, // Client-side only
    "/edit-product/**": { prerender: false, ssr: false }, // Client-side only
    "/login": { prerender: true },
    "/register-user": { prerender: true },
    "/payment-successful": { prerender: false, ssr: false }, // Client-side only
  },

  nitro: {
    prerender: { 
      routes: ["/sitemap.xml", "/robots.txt"],
      crawlLinks: true, // Crawl all links for static generation
    },
  },

  compatibilityDate: "2024-08-03",
});
