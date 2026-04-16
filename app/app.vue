<!--app/app.vue-->
<script setup lang="ts">
const { site } = useAppConfig();
const { name, description } = site;
const config = useRuntimeConfig();
const ogImageLogo = `${config.public?.baseUrl || 'https://www.yardsaleth.com'}/logo.svg`;
const { locale } = useI18n();
const globalKeywords = computed(() => {
  if (locale.value === "th") {
    return [
      name,
      "ตลาดของมือสอง",
      "ซื้อของมือสองออนไลน์",
      "ขายของมือสอง",
      "เฟอร์นิเจอร์มือสอง",
      "เครื่องใช้ไฟฟ้ามือสอง",
      "เสื้อผ้ามือสอง",
      "YardsaleThailand",
    ].join(", ");
  }
  return [
    name,
    "second hand marketplace",
    "buy used products",
    "sell used products",
    "used furniture",
    "used electronics",
    "used fashion",
    "YardsaleThailand",
  ].join(", ");
});

const htmlLang = computed(() => {
  const m: Record<string, string> = {
    th: "th",
    en: "en",
    nb: "nb",
    nl: "nl",
    de: "de",
  };
  return m[locale.value] || "th";
});

const ogLocaleTag = computed(() => {
  const m: Record<string, string> = {
    th: "th_TH",
    en: "en_GB",
    nb: "nb_NO",
    nl: "nl_NL",
    de: "de_DE",
  };
  return m[locale.value] || "th_TH";
});

useHead({
  htmlAttrs: { lang: htmlLang },
  titleTemplate: (chunk?: string) => (chunk ? `${chunk} - ${name}` : name),
  link: [
    { rel: "dns-prefetch", href: "//api.yardsaleth.com" },
    { rel: "preconnect", href: "https://api.yardsaleth.com", crossorigin: "" },
    /** PWA — Safari iOS 16.4+ รับ Web Push ได้ดีขึ้นเมื่อ “เพิ่มไปที่หน้าจอโฮม” แล้วเปิดจากไอคอน */
    { rel: "manifest", href: "/site.webmanifest" },
    { rel: "apple-touch-icon", href: "/logo.png", sizes: "180x180" },
  ],
  meta: [
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-capable", content: "yes" },
    {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black-translucent",
    },
    { name: "apple-mobile-web-app-title", content: name },
    { name: "theme-color", content: "#fafafa" },
  ],
});

useSeoMeta({
  description,
  ogType: "website",
  ogSiteName: name,
  ogLocale: ogLocaleTag,
  ogImage: ogImageLogo,
  twitterCard: "summary_large_image",
  twitterSite: "@zhatlen",
  twitterCreator: "@zhatlen",
  twitterImage: ogImageLogo,
  keywords: globalKeywords,
  viewport:
    "width=device-width, initial-scale=1, viewport-fit=cover",
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Notivue v-slot="item">
    <Notification :item="item" :theme="materialTheme" />
  </Notivue>
</template>

<style lang="postcss">
.dark {
  @apply bg-black text-neutral-100;
  color-scheme: dark;
}
.dropdown-enter-active {
  @apply transition duration-200 ease-out;
}
.dropdown-enter-from,
.dropdown-leave-to {
  @apply translate-y-5 opacity-0;
}
.dropdown-enter-to,
.dropdown-leave-from {
  @apply transform opacity-100;
}
.dropdown-leave-active {
  @apply transition duration-150 ease-in;
}
</style>
