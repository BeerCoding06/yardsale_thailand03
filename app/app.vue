<!--app/app.vue-->
<script setup lang="ts">
const { site } = useAppConfig();
const { name, description } = site;
const config = useRuntimeConfig();
const ogImageLogo = `${config.public?.baseUrl || 'https://www.yardsaleth.com'}/logo.svg`;

useHead({
  htmlAttrs: { lang: "en" },
  titleTemplate: (chunk?: string) => (chunk ? `${chunk} - ${name}` : name),
});

useSeoMeta({
  description,
  ogType: "website",
  ogSiteName: name,
  ogLocale: "en_US",
  ogImage: ogImageLogo,
  twitterCard: "summary_large_image",
  twitterSite: "@zhatlen",
  twitterCreator: "@zhatlen",
  twitterImage: ogImageLogo,
  keywords: `${name}, ecommerce, nuxt`,
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover",
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
