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
    // WordPress base URL - can be set via .env file
    wpBaseUrl: process.env.WP_BASE_URL || 'http://157.85.98.150:8080',
    wpBasicAuth: process.env.WP_BASIC_AUTH || '',
    wpConsumerKey: process.env.WP_CONSUMER_KEY || '',
    wpConsumerSecret: process.env.WP_CONSUMER_SECRET || '',
    public: {
      version: pkg.version,
    },
  },

  routeRules: {
    // Disable prerender during Docker build to avoid errors
    // All routes use SSR or client-side rendering
    "/": { ssr: true, prerender: false },
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
  },

  nitro: {
    prerender: { 
      routes: [], // Disable prerender during Docker build
      crawlLinks: false, // Disable crawlLinks during Docker build to avoid errors
    },
  },
  
  typescript: {
    typeCheck: false, // Disable type checking during build to avoid errors
  },

  compatibilityDate: "2024-08-03",
});
