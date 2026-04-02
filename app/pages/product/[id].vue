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
const url = useRequestURL();
const config = useRuntimeConfig();
const { locale } = useI18n();

const {
  hasRemoteApi,
  endpoint,
  unwrapYardsaleResponse,
  mapApiProductRow,
  isUuidString,
  isStorefrontPublishedProduct,
} = useStorefrontCatalog();

// Parse slug + sku จาก [id] (รูปแบบ slug-sku เช่น my-product-12345)
const idParam = computed(() => {
  const p = route.params.id;
  return Array.isArray(p) ? p[0] : (p ?? '');
});
const slug = computed(() => {
  const id = idParam.value;
  if (!id || typeof id !== 'string') return '';
  const parts = id.split('-');
  if (parts.length < 2) return id; // มีแค่ตัวเดียว ส่งเป็น slug หรือ id
  const skuPart = parts.pop();
  return parts.join('-');
});
const sku = computed(() => {
  const id = idParam.value;
  if (!id || typeof id !== 'string') return '';
  const parts = id.split('-');
  return parts.length >= 2 ? parts.pop() : '';
});

const productResult = ref({});
const selectedVariation = ref(null);
const isLoading = ref(true);

async function fetchProduct() {
  const routeId = String(idParam.value || "");
  const rawQueryId = route.query.id;
  const queryIdStr = String(
    Array.isArray(rawQueryId) ? rawQueryId[0] : rawQueryId || ""
  );
  const apiProductId =
    hasRemoteApi && isUuidString(routeId)
      ? routeId
      : hasRemoteApi && isUuidString(queryIdStr)
        ? queryIdStr
        : "";

  if (apiProductId) {
    isLoading.value = true;
    try {
      const raw = await $fetch(endpoint(`product/${apiProductId}`));
      const data = unwrapYardsaleResponse(raw);
      const p = data?.product ?? data;
      const mapped = mapApiProductRow(p) || {};
      productResult.value = isStorefrontPublishedProduct(mapped)
        ? mapped
        : {};
    } catch (error) {
      console.error("[product] Error fetching product (API):", error);
      productResult.value = {};
    } finally {
      isLoading.value = false;
    }
    return;
  }

  const s = slug.value;
  const k = sku.value;
  const rawQueryId2 = route.query.id;
  const queryId = Array.isArray(rawQueryId2) ? rawQueryId2[0] : rawQueryId2;
  const hasId = queryId && /^\d+$/.test(String(queryId));
  if (!hasId && !s && !k) {
    const rawId = idParam.value;
    if (!rawId || (!/^\d+$/.test(String(rawId)) && !s && !k)) {
      productResult.value = {};
      isLoading.value = false;
      return;
    }
  }
  isLoading.value = true;
  try {
    const query = {};
    if (hasId) {
      query.id = Number(queryId);
    } else {
      if (s) query.slug = s;
      if (k) query.sku = k;
      const rawId = idParam.value;
      if (rawId && /^\d+$/.test(String(rawId))) query.id = Number(rawId);
      else if (!s && k && /^\d+$/.test(k)) query.id = Number(k);
    }
    const data = await $fetch("/api/product", { query });
    const prod = data?.product || {};
    productResult.value = isStorefrontPublishedProduct(prod) ? prod : {};
  } catch (error) {
    console.error("[product] Error fetching product:", error);
    productResult.value = {};
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchProduct();
});

// Refetch เมื่อเปลี่ยน product (เปลี่ยน URL หรือ query.id)
watch([slug, sku, () => route.query.id, idParam], () => {
  fetchProduct();
});

const product = computed(() => productResult.value);

const productCanonical = computed(() => {
  const base = config.public?.baseUrl || url.origin;
  const p = route.params.id;
  const id = Array.isArray(p) ? p[0] : String(p || "");
  return `${base}${localePath(`/product/${id}`)}`;
});

const productImage = computed(
  () => product.value?.image?.sourceUrl || `${config.public?.baseUrl || url.origin}/logo.svg`
);

const productSeo = computed(() => {
  const p = product.value || {};
  const isThai = String(locale.value || "th").toLowerCase().startsWith("th");
  const productName = String(p.name || "").trim();
  const categoryName = String(p?.categories?.nodes?.[0]?.name || "").trim();
  const price =
    String(p.salePrice || p.regularPrice || "").replace(/<[^>]*>/g, "").trim();

  const hasProduct = productName.length > 0;
  const title = hasProduct
    ? isThai
      ? `${productName}${categoryName ? ` | ${categoryName}` : ""} | สินค้ามือสอง YardsaleThailand`
      : `${productName}${categoryName ? ` | ${categoryName}` : ""} | Second hand products | YardsaleThailand`
    : isThai
      ? "สินค้ามือสอง | YardsaleThailand"
      : "Second hand products | YardsaleThailand";
  const description = hasProduct
    ? isThai
      ? `ซื้อ ${productName}${price ? ` ราคา ${price}` : ""} บน YardsaleThailand${
          categoryName ? ` หมวด ${categoryName}` : ""
        } รวมหมวดเฟอร์นิเจอร์ อิเล็กทรอนิกส์ แฟชั่น และของมือสองอื่นๆ`
      : `Buy ${productName}${price ? ` at ${price}` : ""} on YardsaleThailand${
          categoryName ? ` in ${categoryName}` : ""
        }. Shop second hand products across furniture, electronics, and fashion.`
    : isThai
      ? "เลือกซื้อสินค้ามือสองสภาพดีจากผู้ขายจริงบน YardsaleThailand ครบหมวดเฟอร์นิเจอร์ อิเล็กทรอนิกส์ และแฟชั่น"
      : "Shop second hand products from real sellers on YardsaleThailand across furniture, electronics, and fashion.";

  const keywords = [
    productName,
    categoryName,
    "สินค้ามือสอง",
    "ตลาดของมือสอง",
    "ซื้อของมือสองออนไลน์",
    "second hand thailand",
  ]
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .join(", ");

  return { title, description, keywords };
});

function parsePriceNumber(raw) {
  const cleaned = String(raw || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[^0-9.,-]/g, "")
    .replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const v = String(value ?? "").trim();
    if (v) return v;
  }
  return "";
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const productJsonLd = computed(() => {
  const p = product.value || {};
  const name = String(p.name || "").trim();
  if (!name) return null;

  const priceValue = parsePriceNumber(p.salePrice || p.regularPrice);
  const currency = "THB";
  const inStock =
    p.stockStatus !== "OUT_OF_STOCK" &&
    (p.stockQuantity == null || Number(p.stockQuantity) > 0);
  const condition = "https://schema.org/UsedCondition";

  const imageList = [
    p.image?.sourceUrl,
    ...(Array.isArray(p.galleryImages?.nodes)
      ? p.galleryImages.nodes.map((n) => n?.sourceUrl)
      : []),
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const description = String(productSeo.value.description || "").trim();
  const category = String(p?.categories?.nodes?.[0]?.name || "").trim();
  const skuValue = String(p.sku || "").trim();
  const brandName = String(p?.brand?.name || "YardsaleThailand").trim();
  const gtinValue = firstNonEmpty(p.gtin, p.gtin13, p.gtin12, p.gtin14, p.ean, p.upc);
  const mpnValue = firstNonEmpty(p.mpn);
  const ratingValue = firstFiniteNumber(
    p.averageRating,
    p.ratingValue,
    p.rating,
    p.reviewSummary?.averageRating
  );
  const reviewCount = firstFiniteNumber(
    p.reviewCount,
    p.ratingCount,
    p.reviewsCount,
    p.reviewSummary?.reviewCount
  );
  const reviewNodes = Array.isArray(p.reviews?.nodes) ? p.reviews.nodes : [];
  const reviews = reviewNodes
    .slice(0, 3)
    .map((r) => {
      const authorName = firstNonEmpty(r?.author?.name, r?.authorName, "Customer");
      const body = firstNonEmpty(r?.content, r?.body, r?.comment);
      const score = firstFiniteNumber(r?.rating, r?.ratingValue);
      return {
        "@type": "Review",
        author: { "@type": "Person", name: authorName },
        ...(body ? { reviewBody: body } : {}),
        ...(score != null
          ? {
              reviewRating: {
                "@type": "Rating",
                ratingValue: score,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      };
    })
    .filter((r) => r.reviewBody || r.reviewRating);

  const productNode = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productCanonical.value}#product`,
    name,
    ...(description ? { description } : {}),
    ...(imageList.length ? { image: imageList } : {}),
    ...(skuValue ? { sku: skuValue } : {}),
    ...(gtinValue ? { gtin: gtinValue } : {}),
    ...(mpnValue ? { mpn: mpnValue } : {}),
    ...(category ? { category } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": productCanonical.value,
    },
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    url: productCanonical.value,
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: condition,
      url: productCanonical.value,
      ...(priceValue != null ? { price: priceValue } : {}),
      seller: {
        "@type": "Organization",
        name: "YardsaleThailand",
      },
    },
    ...(ratingValue != null && reviewCount != null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue,
            reviewCount,
          },
        }
      : {}),
    ...(reviews.length ? { review: reviews } : {}),
  };

  return productNode;
});

useSeoMeta(() => ({
  title: productSeo.value.title,
  ogTitle: productSeo.value.title,
  description: productSeo.value.description,
  ogDescription: productSeo.value.description,
  keywords: productSeo.value.keywords,
  ogType: "product",
  ogUrl: productCanonical.value,
  ogImage: productImage.value,
  twitterTitle: productSeo.value.title,
  twitterDescription: productSeo.value.description,
  twitterImage: productImage.value,
  twitterCard: "summary_large_image",
  robots: "index, follow",
}));

useHead(() => ({
  link: [{ rel: "canonical", href: productCanonical.value }],
  meta: [
    { name: "author", content: "YardsaleThailand" },
    { name: "publisher", content: "YardsaleThailand" },
  ],
  script: productJsonLd.value
    ? [
        {
          type: "application/ld+json",
          children: JSON.stringify(productJsonLd.value),
        },
      ]
    : [],
}));

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
    const salable = (v) =>
      v &&
      v.stockStatus !== 'OUT_OF_STOCK' &&
      !(
        v.stockQuantity != null &&
        v.stockQuantity !== '' &&
        Number.isFinite(Number(v.stockQuantity)) &&
        Number(v.stockQuantity) < 1
      );
    selectedVariation.value =
      sortedVariations.value.find((v) => salable(v)) || sortedVariations.value[0];
  }
});

/** สต็อก &lt; 1 หรือหมด → ไม่ให้ใส่ตะกร้า */
const addToCartStockNode = computed(() => {
  if (isSimpleProduct.value) return product.value;
  return selectedVariation.value;
});

const variationUnsalable = (variation) => {
  if (!variation) return true;
  if (variation.stockStatus === 'OUT_OF_STOCK') return true;
  const q = variation.stockQuantity;
  if (q != null && q !== '' && Number.isFinite(Number(q)) && Number(q) < 1) {
    return true;
  }
  return false;
};

const canAddToCart = computed(() => {
  if (isCancelled.value) return false;
  const node = addToCartStockNode.value;
  if (!node || !product.value?.name) return false;
  const st = String(node.stockStatus ?? '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (st === 'OUT_OF_STOCK' || st === 'OUTOFSTOCK') return false;
  const qRaw = node.stockQuantity;
  if (qRaw != null && qRaw !== '') {
    const q = Number(qRaw);
    if (Number.isFinite(q) && q < 1) return false;
  }
  return true;
});

const { handleAddToCart, addToCartButtonStatus } = useCart();
</script>

<template>
  <div>
    <ProductSkeleton v-if="isLoading || !product?.name" />
    <template v-else>
      <header class="sr-only">
        <h2>{{ productSeo.title }}</h2>
        <h3>{{ productSeo.description }}</h3>
        <h4>Second hand products: furniture, electronics, fashion</h4>
        <h5>YardsaleThailand marketplace listing</h5>
      </header>
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
          <StorefrontImg
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
          <StorefrontImg
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
            <StorefrontImg
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
            <StorefrontImg
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
                    <StorefrontImg
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
                    variation && variationUnsalable(variation) ? 'disabled' : '',
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
                    :disabled="variation && variationUnsalable(variation)"
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
              <span :class="(!isCancelled && product.stockStatus === 'OUT_OF_STOCK') ? 'text-red-500' : 'text-green-500'">
                {{ (!isCancelled && product.stockStatus === 'OUT_OF_STOCK') ? '0' : (product.stockQuantity || $t("cart.in_stock")) }}
              </span>
            </div>
            
            <div class="flex">
              <button
                @click="
                  handleAddToCart(
                    selectedVariation?.databaseId || product.databaseId,
                    isSimpleProduct ? undefined : product.databaseId
                  )
                "
                :disabled="!canAddToCart || addToCartButtonStatus !== 'add'"
                class="button-bezel w-full h-12 rounded-md relative tracking-wide font-semibold text-white text-sm flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Transition name="slide-up">
                  <div v-if="addToCartButtonStatus === 'add'" class="absolute">
                    {{
                      canAddToCart
                        ? $t("cart.add_to_cart")
                        : $t("cart.out_of_stock")
                    }}
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
