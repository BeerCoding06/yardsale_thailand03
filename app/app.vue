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
    console.log("[app] Fetching categories from /api/categories?parent=0&hide_empty=false");
    // Use hide_empty=false to show all categories even if they have no products
    const response = await $fetch("/api/categories?parent=0&hide_empty=false");
    console.log("[app] Categories response:", response);
    console.log("[app] Response type:", typeof response);
    console.log("[app] Has productCategories?", !!response?.productCategories);
    console.log("[app] Has nodes?", !!response?.productCategories?.nodes);
    console.log("[app] Nodes is array?", Array.isArray(response?.productCategories?.nodes));

    // แสดง categories ทั้งหมดที่ดึงมา (ไม่ต้อง filter เพราะ API ดึงมาแล้ว)
    if (response?.productCategories?.nodes && Array.isArray(response.productCategories.nodes)) {
      categoriesData.value = response.productCategories.nodes;
      console.log("[app] Loaded categories:", categoriesData.value.length);
      
      // Debug: log first category structure
      if (categoriesData.value.length > 0) {
        console.log("[app] First category:", categoriesData.value[0]);
        console.log("[app] First category keys:", Object.keys(categoriesData.value[0]));
      } else {
        console.warn("[app] Categories array is empty");
        // Show debug info if available
        if (response.debug) {
          console.warn("[app] Debug info:", response.debug);
        }
      }
    } else {
      categoriesData.value = [];
      console.warn("[app] No categories in response");
      console.warn("[app] Response structure:", {
        hasProductCategories: !!response?.productCategories,
        hasNodes: !!response?.productCategories?.nodes,
        nodesType: typeof response?.productCategories?.nodes,
        isArray: Array.isArray(response?.productCategories?.nodes),
        debug: response?.debug,
        error: response?.error,
        fullResponse: response
      });
    }
  } catch (error) {
    console.error("[app] Error fetching categories:", error);
    console.error("[app] Error details:", {
      message: error?.message,
      statusCode: error?.statusCode,
      data: error?.data
    });
    categoriesData.value = [];
  }
});

const categories = computed(() => categoriesData.value);

// Debug: Watch categories changes
watch(categories, (newCategories) => {
  console.log('[app] Categories computed changed:', newCategories?.length || 0);
  console.log('[app] Categories data:', newCategories);
}, { deep: true, immediate: true });
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
