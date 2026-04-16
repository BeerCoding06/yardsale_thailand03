<!--app/pages/categories.vue-->
<script setup>
const { name } = useAppConfig().site;
const url = useRequestURL();
const localePath = useLocalePath();
const { locale } = useI18n();

const categoriesData = ref([]);
const canonical = url.origin + url.pathname;
const config = useRuntimeConfig();
const ogImageLogo = `${config.public?.baseUrl || url.origin}/logo.svg`;

const seo = computed(() => {
  const isThai = String(locale.value || "th").startsWith("th");
  const title = isThai ? `หมวดหมู่สินค้า | ${name}` : `Product categories | ${name}`;
  const description = isThai
    ? `เลือกดูหมวดหมู่สินค้ามือสองบน ${name} เช่น เฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า และแฟชั่น`
    : `Browse second hand product categories on ${name}: furniture, electronics, fashion, and more.`;
  const keywords = isThai
    ? `หมวดหมู่สินค้า, ของมือสอง, เฟอร์นิเจอร์มือสอง, เครื่องใช้ไฟฟ้ามือสอง, ${name}`
    : `product categories, second hand marketplace, used furniture, used electronics, ${name}`;
  return { title, description, keywords };
});

useSeoMeta(() => ({
  title: seo.value.title,
  ogTitle: seo.value.title,
  description: seo.value.description,
  ogDescription: seo.value.description,
  ogUrl: canonical,
  keywords: seo.value.keywords,
  twitterTitle: seo.value.title,
  twitterDescription: seo.value.description,
  ogImage: ogImageLogo,
  twitterImage: ogImageLogo,
  twitterCard: "summary_large_image",
}));

useHead(() => ({
  link: [{ rel: "canonical", href: canonical }],
  meta: [
    { name: "robots", content: "index, follow" },
    { name: "author", content: "YardsaleThailand" },
    { name: "publisher", content: "YardsaleThailand" },
  ],
}));

const { hasRemoteApi, fetchYardsale, resolveMediaUrl } = useStorefrontCatalog();

onMounted(async () => {
  try {
    const response = hasRemoteApi
      ? await fetchYardsale("categories")
      : await $fetch("/api/categories?parent=0");

    // API already returns categories with parent=0, so use them directly
    // Since we're querying with parent=0, all returned categories should be parent categories
    if (response?.productCategories?.nodes) {
      const nodes = response.productCategories.nodes;
      categoriesData.value = nodes.map((cat) => {
        const rawSrc = cat.image?.sourceUrl;
        const resolved =
          rawSrc && hasRemoteApi
            ? resolveMediaUrl(rawSrc) ?? rawSrc
            : rawSrc;
        return {
          ...cat,
          image: resolved ? { sourceUrl: resolved } : cat.image,
        };
      });

    } else {
      categoriesData.value = [];
      console.warn("[categories] No categories found in response");
    }
  } catch (error) {
    console.error("[categories] Error fetching categories:", error);
    categoriesData.value = [];
  }
});

const categories = computed(() => categoriesData.value);
</script>

<template>
  <div>
    <!-- <div class="flex items-center pl-3 lg:pl-5">
      <ButtonSelectCategory />
    </div> -->
    <div class="flex flex-wrap justify-center max-w-screen-2xl m-auto">
      <template v-if="!categories.length">
        <div
          v-for="i in 13"
          :key="i"
          class="w-full max-w-[444px] p-3 lg:p-2"
        >
          <div
            class="pb-[75%] relative overflow-hidden bg-neutral-200 dark:bg-neutral-800 skeleton rounded-[32px]"
          ></div>
        </div>
      </template>
      <NuxtLink
        v-for="category in categories"
        :key="category.id"
        :to="localePath(`/?category=${encodeURIComponent(category.slug || category.name || '')}`)"
        class="w-full max-w-[444px] p-3 lg:p-2"
      >
        <div class="pb-[75%] relative overflow-hidden">
          <StorefrontImg
            :alt="category.name"
            v-if="category.image"
            class="object-cover absolute top-0 left-0 w-full h-full bg-neutral-200 dark:bg-neutral-800 rounded-[32px]"
            :src="category.image.sourceUrl"
            loading="lazy"
            :title="category.name"
          />
          <div
            class="absolute left-0 right-0 top-0 bottom-0 bg-gradient-to-t hover:from-black/40 rounded-[32px] overflow-hidden"
          >
            <div
              class="w-full h-full bg-gradient-to-t from-black/40 items-end py-6 px-5 flex"
            >
              <div class="w-full text-center font-semibold text-3xl text-white">
                {{ category.name }}
              </div>
            </div>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
