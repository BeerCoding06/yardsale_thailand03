<script setup lang="ts">
// Storefront layout: header, footer, category carousel (ไม่ใช้กับ CMS)
const categoriesData = ref([]);
const { hasRemoteApi, endpoint, unwrapYardsaleResponse, resolveMediaUrl } =
  useStorefrontCatalog();

onMounted(async () => {
  try {
    const response = hasRemoteApi
      ? unwrapYardsaleResponse(await $fetch(endpoint("categories")))
      : await $fetch("/api/categories?parent=0&hide_empty=false");
    if (response?.productCategories?.nodes && Array.isArray(response.productCategories.nodes)) {
      const nodes = response.productCategories.nodes;
      categoriesData.value = nodes
        .filter((cat: { name?: string }) => {
          const name = (cat.name || "").trim();
          const lowerName = name.toLowerCase();
          return (
            name !== "" &&
            lowerName !== "no category" &&
            lowerName !== "uncategorized" &&
            lowerName !== "uncategorised"
          );
        })
        .map((cat: any, index: number) => {
          const rawSrc = cat.image?.sourceUrl;
          const resolved =
            rawSrc && hasRemoteApi
              ? resolveMediaUrl(rawSrc) ?? rawSrc
              : rawSrc;
          return {
          id: cat.id || cat.databaseId || index,
          databaseId: cat.databaseId || cat.id || index,
          name: cat.name || "Unnamed Category",
          slug: cat.slug || "",
          description: cat.description || "",
          image: resolved ? { sourceUrl: resolved } : cat.image || null,
          parent: cat.parent || null,
          count: cat.count || 0,
          children: cat.children || { nodes: [] },
          products: cat.products || { nodes: [] },
        };
        });
    } else {
      categoriesData.value = [];
    }
  } catch {
    categoriesData.value = [];
  }
});

const categories = computed(() => categoriesData.value);
</script>

<template>
  <AppHeader />
  <main class="pt-[90px] lg:pt-20 min-h-[calc(100vh-90px)]">
    <slot />
  </main>
  <AppFooter />
  <ClientOnly>
    <CarouselCategories :categories="categories" />
  </ClientOnly>
</template>
