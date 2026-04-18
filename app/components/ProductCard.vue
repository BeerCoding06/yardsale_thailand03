<!--app/components/ProductCard.vue-->
<script setup>
const localePath = useLocalePath();
const { t } = useI18n();
const { isUuidString, storefrontProductPath } = useStorefrontCatalog();
const { handleAddToCart } = useCart();

defineProps({
  products: {
    type: Array,
    required: true,
  },
});

const cartBusyKey = ref(null);

function cartProductKey(product) {
  return String(product?.databaseId ?? product?.id ?? "");
}

function isOutOfStock(product) {
  const st = String(product?.stockStatus || "")
    .toUpperCase()
    .replace(/\s/g, "_");
  if (st === "OUT_OF_STOCK" || st === "OUTOFSTOCK") return true;
  const q = product?.stockQuantity;
  if (q === null || q === undefined) return false;
  return Number(q) <= 0;
}

async function onAddCart(product) {
  const key = cartProductKey(product);
  if (!key || isOutOfStock(product)) return;
  cartBusyKey.value = key;
  try {
    await handleAddToCart(key);
  } finally {
    cartBusyKey.value = null;
  }
}

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
  <div class="contents">
    <article v-for="(product, idx) in products" :key="product.id || product.sku">
      <div class="group select-none">
        <!-- รูป: ลิงก์เป็น overlay เฉพาะพื้นที่รูป — ปุ่มตะกร้า/หัวใจอยู่นอกลิงก์จึงไม่เปิด product detail -->
        <div
          class="relative aspect-[3/4] dark:shadow-[0_8px_24px_rgba(0,0,0,.5)] rounded-2xl overflow-hidden"
        >
          <template v-if="product.galleryImages?.nodes?.length > 0">
            <StorefrontImg
              :alt="product.name"
              :loading="idx === 0 ? 'eager' : 'lazy'"
              :fetchpriority="idx === 0 ? 'high' : 'auto'"
              :decoding="idx === 0 ? 'sync' : 'async'"
              :title="product.name"
              :src="product.galleryImages.nodes[0].sourceUrl"
              :srcset="product.galleryImages.nodes[0].srcSet || undefined"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 20vw"
              class="absolute inset-0 z-0 h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover"
              v-if="product.galleryImages.nodes[0]?.sourceUrl"
            />
            <StorefrontImg
              v-if="product.galleryImages.nodes.length > 1 && product.image?.sourceUrl"
              :alt="product.name"
              loading="lazy"
              :title="product.name"
              :src="product.image.sourceUrl"
              :srcset="product.image.srcSet || undefined"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 20vw"
              class="absolute inset-0 z-0 h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover transition-opacity duration-300 group-hover:opacity-0"
            />
          </template>
          <template v-else>
            <StorefrontImg
              :alt="product.name"
              :loading="idx === 0 ? 'eager' : 'lazy'"
              :fetchpriority="idx === 0 ? 'high' : 'auto'"
              :decoding="idx === 0 ? 'sync' : 'async'"
              :title="product.name"
              :src="product.image?.sourceUrl"
              :srcset="product.image?.srcSet || undefined"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 20vw"
              class="absolute inset-0 z-0 h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover"
            />
          </template>
          <NuxtLink
            :to="productLink(product)"
            class="absolute inset-0 z-[1]"
            :aria-label="String(product.name || $t('common.product'))"
            tabindex="-1"
          />
          <div class="absolute top-2 right-2 z-2 flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              class="w-11 h-11 rounded-full flex items-center justify-center bg-white/95 dark:bg-neutral-900/95 shadow-md border border-neutral-200/90 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
              :disabled="isOutOfStock(product) || cartBusyKey === cartProductKey(product)"
              :title="t('cart.add_to_cart')"
              :aria-label="t('cart.add_to_cart')"
              @click.prevent.stop="onAddCart(product)"
            >
              <UIcon
                :name="
                  cartBusyKey === cartProductKey(product)
                    ? 'i-svg-spinners-90-ring-with-bg'
                    : 'i-heroicons-shopping-cart'
                "
                class="w-5 h-5 text-neutral-900 dark:text-neutral-100"
              />
            </button>
            <ButtonWishlist :product="product" compact />
          </div>
        </div>
        <NuxtLink
          :to="productLink(product)"
          class="block cursor-pointer transition ease-[ease] duration-300"
        >
          <div class="grid gap-0.5 pt-3 pb-4 px-1.5 text-sm font-semibold min-h-[112px]">
            <ProductPrice
              :sale-price="product.salePrice || ''"
              :regular-price="product.regularPrice || ''"
              variant="card"
            />
            <div
              :class="[
                'font-normal text-[#5f5f5f] dark:text-[#a3a3a3] break-words',
                product.allPaStyle?.nodes?.[0]?.name ? 'line-clamp-2' : 'line-clamp-3',
              ]"
            >
              {{ product.name }}
            </div>
            <div
              class="font-normal text-[#5f5f5f] dark:text-[#a3a3a3] line-clamp-1 min-h-[20px]"
              v-if="product.allPaStyle?.nodes?.[0]?.name"
            >
              {{ product.allPaStyle.nodes[0].name }}
            </div>
            <div
              class="font-normal text-xs text-[#5f5f5f] dark:text-[#a3a3a3] min-h-[18px]"
              :class="{
                invisible:
                  product.stockQuantity === null || product.stockQuantity === undefined,
              }"
            >
              {{ $t('cart.stock') }}
              {{
                product.stockQuantity === null || product.stockQuantity === undefined
                  ? "-"
                  : product.stockQuantity
              }}
            </div>
          </div>
        </NuxtLink>
      </div>
    </article>
  </div>
</template>
