<!--app/app.vue-->
<script setup lang="ts">
const { site } = useAppConfig();
const { name, description } = site;

useHead({
  htmlAttrs: { lang: "en" },
  titleTemplate: (chunk?: string) => (chunk ? `${chunk} - ${name}` : name),
});

useSeoMeta({
  description,
  ogType: "website",
  ogSiteName: name,
  ogLocale: "en_US",
  ogImage: "https://commerce.nuxt.dev/social-card.jpg",
  twitterCard: "summary_large_image",
  twitterSite: "@zhatlen",
  twitterCreator: "@zhatlen",
  twitterImage: "https://commerce.nuxt.dev/social-card.jpg",
  keywords: `${name}, ecommerce, nuxt, woocommerce`,
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover",
});

// Categories data for CarouselCategories (แสดงในทุกหน้า)
const categoriesData = ref([]);

onMounted(async () => {
  try {
    const response = await $fetch("/api/categories?parent=0");
    console.log("[app] Categories response:", response);

    // แสดง categories ทั้งหมดที่ดึงมา (ไม่ต้อง filter เพราะ API ดึงมาแล้ว)
    if (response?.productCategories?.nodes) {
      categoriesData.value = response.productCategories.nodes;
      console.log("[app] Loaded categories:", categoriesData.value.length);
      
      // Debug: log first category structure
      if (categoriesData.value.length > 0) {
        console.log("[app] First category:", categoriesData.value[0]);
      }
    } else {
      categoriesData.value = [];
      console.warn("[app] No categories in response");
    }
  } catch (error) {
    console.error("[app] Error fetching categories:", error);
    categoriesData.value = [];
  }
});

const categories = computed(() => categoriesData.value);
</script>

<template>
  <AppHeader />
  <main class="pt-[90px] lg:pt-20 min-h-[calc(100vh-90px)]">
    <NuxtPage />
  </main>
  <AppFooter />
  <ClientOnly>
    <CarouselCategories :categories="categories" />
  </ClientOnly>
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
