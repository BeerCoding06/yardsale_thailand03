<!--app/components/ProductCard.vue-->
<script setup>
const localePath = useLocalePath();
const { isUuidString, storefrontProductPath } = useStorefrontCatalog();

defineProps({
  products: {
    type: Array,
    required: true,
  },
});

function productLink(product) {
  const id = product.databaseId ?? product.id;
  if (product.__fromApi || isUuidString(String(id))) {
    return localePath(storefrontProductPath(product));
  }
  const path = `/product/${product.slug}-${product.sku?.split?.('-')[0] || ''}`;
  const query = id ? { id: String(id) } : {};
  return (
    localePath(path) +
    (Object.keys(query).length
      ? "?" + new URLSearchParams(query).toString()
      : "")
  );
}
</script>

<template>

    <div v-for="(product, idx) in products" :key="product.id || product.sku">
      <article>
        <NuxtLink
          :to="productLink(product)"
          class="group select-none"
        >
          <div class="cursor-pointer transition ease-[ease] duration-300">
            <div
              class="relative pb-[133%] dark:shadow-[0_8px_24px_rgba(0,0,0,.5)] rounded-2xl overflow-hidden"
            >
              <template v-if="product.galleryImages?.nodes?.length > 0">
                <StorefrontImg
                  :alt="product.name"
                  :loading="idx < 4 ? 'eager' : 'lazy'"
                  :fetchpriority="idx < 4 ? 'high' : 'auto'"
                  :decoding="idx < 4 ? 'sync' : 'async'"
                  :title="product.name"
                  :src="product.galleryImages.nodes[0].sourceUrl"
                  class="absolute h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover"
                  v-if="product.galleryImages.nodes[0]?.sourceUrl"
                />
                <StorefrontImg
                  v-if="product.galleryImages.nodes.length > 1 && product.image?.sourceUrl"
                  :alt="product.name"
                  loading="lazy"
                  :title="product.name"
                  :src="product.image.sourceUrl"
                  class="absolute h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover transition-opacity duration-300 group-hover:opacity-0"
                />
                <!-- only add hover if there are 2+ images -->
              </template>
              <template v-else>
                <StorefrontImg
                  :alt="product.name"
                  :loading="idx < 4 ? 'eager' : 'lazy'"
                  :fetchpriority="idx < 4 ? 'high' : 'auto'"
                  :decoding="idx < 4 ? 'sync' : 'async'"
                  :title="product.name"
                  :src="product.image?.sourceUrl"
                  class="absolute h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover"
                />
              </template>
            </div>
            <div class="grid gap-0.5 pt-3 pb-4 px-1.5 text-sm font-semibold">
              <ProductPrice
                :sale-price="product.salePrice || ''"
                :regular-price="product.regularPrice || ''"
                variant="card"
              />
              <div class="font-normal text-[#5f5f5f] dark:text-[#a3a3a3]">
                {{ product.name }}
              </div>
              <div
                class="font-normal text-[#5f5f5f] dark:text-[#a3a3a3]"
                v-if="product.allPaStyle?.nodes?.[0]?.name"
              >
                {{ product.allPaStyle.nodes[0].name }}
              </div>
              <div
                v-if="product.stockQuantity !== null && product.stockQuantity !== undefined"
                class="font-normal text-xs text-[#5f5f5f] dark:text-[#a3a3a3]"
              >
                {{ $t('cart.stock') }} {{ product.stockQuantity }}
              </div>
            </div>
          </div>
        </NuxtLink>
      </article>
    </div>

</template>
