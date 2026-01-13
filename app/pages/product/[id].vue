<!--app/pages/product/[id].vue-->
<script setup>
import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation, Pagination, Thumbs } from "swiper/modules";
const { isOpenImageSliderModal } = useComponents();
const localePath = useLocalePath();

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const thumbsSwiper = ref(null);
const setThumbsSwiper = (swiper) => {
  thumbsSwiper.value = swiper;
};

const modules = [Navigation, Pagination, Thumbs];

const route = useRoute();
const id = computed(() => route.params.id);
const parts = id.value.split("-");
const sku = parts.pop();
const slug = parts.join("-");

const productResult = ref({});
const selectedVariation = ref(null);
const isLoading = ref(true);
const hasBuyer = ref(false);
const checkingBuyer = ref(false);

onMounted(async () => {
  try {
    const data = await $fetch("/api/product", {
      query: { slug, sku },
    });
    productResult.value = data.product || {};
    
    // Check if product has been purchased
    if (productResult.value.databaseId) {
      checkingBuyer.value = true;
      try {
        const buyerData = await $fetch("/api/check-product-has-orders", {
          query: { product_id: productResult.value.databaseId },
        });
        hasBuyer.value = buyerData.has_orders || false;
      } catch (error) {
        console.error('[product] Error checking buyer:', error);
        hasBuyer.value = false;
      } finally {
        checkingBuyer.value = false;
      }
    }
  } catch (error) {
    console.error('[product] Error fetching product:', error);
    productResult.value = {};
  } finally {
    isLoading.value = false;
  }
});

const product = computed(() => productResult.value);

// Check if product is simple (no variations)
const isSimpleProduct = computed(() => {
  return !product.value.variations?.nodes || product.value.variations.nodes.length === 0;
});

// Check if product is cancelled or trashed (should show as in stock)
const isCancelled = computed(() => {
  return product.value.status === 'cancelled' || product.value.status === 'trash';
});

const sizeOrder = [
  "xxs",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "2xl",
  "23-24",
  "25",
  "26-27",
  "28-29",
  "30",
  "31-32",
  "33",
  "34-25",
];

const sortedVariations = computed(() => {
  if (!product.value.variations?.nodes) return [];
  return product.value.variations.nodes.slice().sort((a, b) => {
    const aSize = a.attributes?.nodes?.[0]?.value?.toLowerCase() || '';
    const bSize = b.attributes?.nodes?.[0]?.value?.toLowerCase() || '';
    return sizeOrder.indexOf(aSize) - sizeOrder.indexOf(bSize);
  });
});

watchEffect(() => {
  if (isSimpleProduct.value) {
    // For simple products, use the product itself
    selectedVariation.value = {
      databaseId: product.value.databaseId,
      stockStatus: product.value.stockStatus || 'IN_STOCK',
      stockQuantity: product.value.stockQuantity,
      attributes: { nodes: [] }
    };
  } else if (sortedVariations.value.length > 0) {
    const variationInStock = sortedVariations.value.find(
      (variation) => variation.stockStatus === "IN_STOCK"
    );
    selectedVariation.value = variationInStock ? variationInStock : sortedVariations.value[0];
  }
});

const { handleAddToCart, addToCartButtonStatus } = useCart();
</script>

<template>
  <div>
    <ProductSeo v-if="product?.name" :info="product" />
    <ProductSkeleton v-if="isLoading || !product?.name" />
    <template v-else>
      <div class="justify-center flex flex-col lg:flex-row lg:mx-5">
    <ButtonBack />
    <div class="mr-6 mt-5 pt-2.5 max-xl:hidden">
      <swiper
        :modules="modules"
        @swiper="setThumbsSwiper"
        class="product-images-thumbs w-14"
      >
        <swiper-slide
          class="cursor-pointer rounded-xl overflow-hidden border-2 border-white dark:border-black"
        >
          <NuxtImg
            :alt="product.name"
            class="h-full w-full border-2 border-white bg-neutral-200 dark:bg-neutral-800 dark:border-black rounded-[10px]"
            :src="product.image?.sourceUrl"
          />
        </swiper-slide>
        <swiper-slide
          class="cursor-pointer rounded-xl overflow-hidden border-2 border-white dark:border-black"
          v-for="(node, i) in product.galleryImages?.nodes"
          :key="i"
        >
          <NuxtImg
            :alt="product.name"
            class="h-full w-full border-2 border-white bg-neutral-200 dark:bg-neutral-800 dark:border-black rounded-[10px]"
            :src="node.sourceUrl"
          />
        </swiper-slide>
      </swiper>
    </div>
    <div
      class="flex lg:p-5 lg:gap-5 flex-col lg:flex-row lg:border lg:border-transparent lg:dark:border-[#262626] lg:rounded-[32px] lg:shadow-[0_1px_20px_rgba(0,0,0,.15)] lg:mt-2.5 select-none"
    >
      <div class="relative">
        <swiper
          :style="{
            '--swiper-navigation-color': '#000',
            '--swiper-pagination-color': 'rgb(0 0 0 / 50%)',
          }"
          :spaceBetween="4"
          :slidesPerView="1.5"
          :pagination="{
            dynamicBullets: true,
          }"
          :navigation="true"
          :modules="modules"
          :thumbs="{ swiper: thumbsSwiper }"
          class="lg:w-[530px] lg:h-[530px] xl:w-[600px] xl:h-[600px] lg:rounded-2xl"
        >
          <swiper-slide @click="isOpenImageSliderModal = true">
            <NuxtImg
              :alt="product.name"
              class="h-full w-full bg-neutral-200 dark:bg-neutral-800 object-cover"
              :src="product.image?.sourceUrl"
            />
          </swiper-slide>
          <swiper-slide
            @click="isOpenImageSliderModal = true"
            v-for="(node, i) in product.galleryImages?.nodes"
            :key="i"
          >
            <NuxtImg
              :alt="product.name"
              class="h-full w-full bg-neutral-200 dark:bg-neutral-800 object-cover"
              :src="node.sourceUrl"
            />
          </swiper-slide>
        </swiper>
      </div>
      <ImageSliderWithModal
        :product="product"
        v-model="isOpenImageSliderModal"
      />
      <div class="w-full lg:max-w-[28rem]">
        <div
          class="flex-col flex gap-4 lg:max-h-[530px] xl:max-h-[600px] overflow-hidden"
        >
          <div
            class="p-3 lg:pb-4 lg:p-0 border-b border-[#efefef] dark:border-[#262626]"
          >
            <h1 class="text-2xl font-semibold mb-1">{{ product.name }}</h1>
            <ProductPrice
              :sale-price="product.salePrice"
              :regular-price="product.regularPrice"
            />
            <!-- Show "มีผู้ซื้อแล้ว" if product has been purchased -->
            <div v-if="hasBuyer" class="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
              {{ $t("product.has_buyer") }}
            </div>
          </div>
          <template
            v-for="(variation, i) in product.productTypes?.nodes"
            :key="i"
          >
            <div class="flex gap-2 px-3 lg:px-0">
              <template
                v-for="(vars, j) in variation.products.nodes"
                :key="j"
              >
                <div
                  v-if="
                    vars &&
                    vars.allPaColor &&
                    vars.allPaColor.nodes &&
                    vars.allPaColor.nodes.length > 0 &&
                    vars.allPaColor.nodes[0] &&
                    vars.allPaColor.nodes[0].name &&
                    vars.image &&
                    vars.image.sourceUrl &&
                    product &&
                    product.allPaColor &&
                    product.allPaColor.nodes &&
                    product.allPaColor.nodes.length > 0 &&
                    product.allPaColor.nodes[0] &&
                    product.allPaColor.nodes[0].name &&
                    product.sku
                  "
                  :key="j"
                >
                  <NuxtLink
                    :to="
                      localePath(
                        `/product/${vars.slug}-${product.sku.split('-')[0]}`
                      )
                    "
                    :class="[
                      'flex w-12 rounded-lg border-2 select-varitaion transition-all duration-200 bg-neutral-200 dark:bg-neutral-800',
                      vars.allPaColor.nodes[0].name ===
                      product.allPaColor.nodes[0].name
                        ? 'selected-varitaion'
                        : 'border-[#9b9b9b] dark:border-[#8c8c8c]',
                    ]"
                  >
                    <NuxtImg
                      :alt="vars.allPaColor.nodes[0].name"
                      :src="vars.image.sourceUrl"
                      :title="vars.allPaColor.nodes[0].name"
                      class="rounded-md border-2 border-white dark:border-black"
                    />
                  </NuxtLink>
                </div>
              </template>
            </div>
          </template>

          <div
            class="pb-4 px-3 lg:px-0 border-b border-[#efefef] dark:border-[#262626]"
          >
            <!-- Variations selector (only for variable products) -->
            <template v-if="!isSimpleProduct">
              <div
                v-if="
                  selectedVariation &&
                  selectedVariation.attributes &&
                  selectedVariation.attributes.nodes &&
                  selectedVariation.attributes.nodes.length > 0 &&
                  selectedVariation.attributes.nodes.some(
                    (attr) => attr && attr.value && attr.value.trim() !== ''
                  )
                "
                class="text-sm font-semibold leading-5 opacity-50 flex gap-1"
              >
                {{ $t("product.size") }}:
                <div class="uppercase">
                  {{
                    selectedVariation.attributes.nodes
                      .filter(
                        (attr) => attr && attr.value && attr.value.trim() !== ""
                      )
                      .map((attr) => attr.value)
                      .toString()
                  }}
                </div>
              </div>
              <div
                class="flex gap-2 mt-2 mb-4 flex-wrap"
                v-if="
                  selectedVariation &&
                  selectedVariation.attributes &&
                  selectedVariation.attributes.nodes &&
                  selectedVariation.attributes.nodes.length > 0
                "
              >
                <label
                  class="py-1 px-3 rounded-md cursor-pointer select-varitaion border-2 border-[#9b9b9b] dark:border-[#8c8c8c] transition-all duration-200"
                  v-for="variation in sortedVariations"
                  :key="variation.databaseId"
                  :class="[
                    variation && variation.stockStatus === 'OUT_OF_STOCK'
                      ? 'disabled'
                      : '',
                    selectedVariation &&
                    selectedVariation.databaseId === variation.databaseId
                      ? 'selected-varitaion'
                      : '',
                  ]"
                >
                  <input
                    type="radio"
                    class="hidden"
                    name="variation"
                    :value="variation"
                    :disabled="
                      variation && variation.stockStatus === 'OUT_OF_STOCK'
                    "
                    v-model="selectedVariation"
                  />
                  <span
                    class="font-semibold uppercase"
                    :title="`${$t('product.size')}: ${
                      variation &&
                      variation.attributes &&
                      Array.isArray(variation.attributes.nodes)
                        ? variation.attributes.nodes
                            .map((attr) =>
                              attr && attr.value !== undefined ? attr.value : ''
                            )
                            .toString()
                        : ''
                    }`"
                  >
                    {{
                      variation &&
                      variation.attributes &&
                      Array.isArray(variation.attributes.nodes)
                        ? variation.attributes.nodes
                            .map((attr) =>
                              attr && attr.value !== undefined ? attr.value : ""
                            )
                            .toString()
                        : ""
                    }}
                  </span>
                </label>
              </div>
            </template>
            
            <!-- Stock status for simple products -->
            <div
              v-if="isSimpleProduct && product.stockStatus"
              class="text-sm font-semibold leading-5 opacity-50 mb-4"
            >
              {{ $t("cart.stock") }}: 
              <span :class="(!isCancelled && (product.stockStatus === 'OUT_OF_STOCK' || hasBuyer)) ? 'text-red-500' : 'text-green-500'">
                {{ (!isCancelled && (product.stockStatus === 'OUT_OF_STOCK' || hasBuyer)) ? '0' : (product.stockQuantity || $t("cart.in_stock")) }}
              </span>
            </div>
            
            <div class="flex">
              <button
                @click="handleAddToCart(selectedVariation?.databaseId || product.databaseId)"
                :disabled="addToCartButtonStatus !== 'add'"
                class="button-bezel w-full h-12 rounded-md relative tracking-wide font-semibold text-white text-sm flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Transition name="slide-up">
                  <div v-if="addToCartButtonStatus === 'add'" class="absolute">
                    {{ $t("cart.add_to_cart") }}
                  </div>
                  <UIcon
                    v-else-if="addToCartButtonStatus === 'loading'"
                    class="absolute"
                    name="i-svg-spinners-90-ring-with-bg"
                    size="22"
                  />
                  <div
                    v-else-if="addToCartButtonStatus === 'added'"
                    class="absolute"
                  >
                    {{ $t("cart.added_to_cart") }}!
                  </div>
                </Transition>
              </button>
              <ButtonWishlist :product="product" />
            </div>
          </div>
          <div class="px-3 lg:px-0 overflow-scroll h-[500px]">
            <div class="text-base mb-2 font-semibold">
              {{ $t("product.featured_information") }}
            </div>
            <div class="description leading-7 text-sm">
              <ul>
                <li>
                  {{ $t("product.free_return") }}
                  <a class="underline" href="#">{{
                    $t("product.information")
                  }}</a>
                </li>
                <li>{{ $t("product.sku") }}: {{ product.sku }}</li>
                <div v-html="product.description"></div>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div
    class="text-lg lg:text-xl lg:text-center font-semibold mt-4 pt-4 px-3 border-t border-[#efefef] dark:border-[#262626] lg:border-none"
  >
    {{ $t("product.shop_similar") }}
  </div>
  <div
    class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-4 px-3 lg:px-5 xl:px-8 mt-4 lg:mt-5"
  >
      <ProductCard :products="product.related?.nodes" />
      <ProductsSkeleton v-if="!product.name" />
    </div>
    </template>
  </div>
</template>

<style lang="postcss">
.product-images-thumbs .swiper-wrapper {
  @apply flex-col gap-3;
}
.product-images-thumbs .swiper-slide-thumb-active {
  @apply border-black dark:border-white;
}
.swiper-button-next,
.swiper-button-prev {
  @apply bg-white/50 hover:bg-white p-3.5 m-2 rounded-full flex items-center justify-center shadow transition backdrop-blur-sm;
}

.swiper-button-prev.swiper-button-disabled,
.swiper-button-next.swiper-button-disabled {
  @apply hidden;
}

.swiper-pagination {
  @apply bg-white/50 shadow-sm rounded-full py-1 backdrop-blur-sm;
}

.selected-varitaion,
.select-varitaion:hover:not(.disabled) {
  @apply border-alizarin-crimson-700 dark:border-alizarin-crimson-700 text-alizarin-crimson-700 bg-red-700/10;
}

.disabled {
  @apply opacity-40 cursor-default;
}

.button-bezel {
  box-shadow: 0 0 0 var(--button-outline, 0px) rgb(222, 92, 92, 0.3),
    inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.5);
  @apply bg-alizarin-crimson-700 outline-none tracking-[-0.125px] transition scale-[var(--button-scale,1)] duration-200;
  &:hover {
    @apply bg-alizarin-crimson-600;
  }
  &:active {
    --button-outline: 4px;
    --button-scale: 0.975;
  }
}

.description ul li {
  background: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxlbGxpcHNlIHJ5PSIzIiByeD0iMyIgY3k9IjMiIGN4PSIzIiBmaWxsPSIjYzljOWM5Ii8+PC9zdmc+)
    no-repeat 0 0.7rem;
  padding-left: 0.938rem;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease 0s, opacity 0.3s ease 0s;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(-30px) scale(0);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(30px) scale(0);
}
</style>
