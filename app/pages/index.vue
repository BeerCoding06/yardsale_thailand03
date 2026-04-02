<!--app/pages/index.vue-->
<script setup>
const route = useRoute();
const { name } = useAppConfig().site;
const url = useRequestURL();
const { locale } = useI18n();
/** ต้องเรียกนอก useHead — ภายใน callback ของ unhead อาจไม่มี Nuxt context (SSR /locale) */
const runtimeConfig = useRuntimeConfig();
const canonical = computed(() => {
  const base = `${url.origin}${url.pathname}`;
  const params = new URLSearchParams();
  if (typeof route.query.q === "string" && route.query.q)
    params.set("q", route.query.q);
  if (typeof route.query.category === "string" && route.query.category)
    params.set("category", route.query.category);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
});

const pageHeading = computed(() => {
  if (typeof route.query.q === "string" && route.query.q.trim()) {
    return `Search results for "${route.query.q.trim()}"`;
  }
  if (typeof route.query.category === "string" && route.query.category.trim()) {
    return `${route.query.category.trim()} products`;
  }
  return `${name} - second hand marketplace`;
});

const seoContent = computed(() => {
  const q = typeof route.query.q === "string" ? route.query.q : undefined;
  const category =
    typeof route.query.category === "string" ? route.query.category : undefined;
  const lang = String(locale.value || "th").toLowerCase();
  const isThai = lang.startsWith("th");
  const categorySlug = String(category || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  let title = isThai ? `${name} ตลาดของมือสองออนไลน์` : `${name} second hand marketplace`;
  let description = isThai
    ? `ซื้อขายของมือสองง่ายๆ บน ${name} รวมเฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า เสื้อผ้า และสินค้าใช้แล้วสภาพดี`
    : `Buy and sell second hand products on ${name}: furniture, electronics, fashion, and more.`;

  const baseKeywords = isThai
    ? [
        "ขายของมือสอง",
        "ตลาดของมือสอง",
        "ของมือสองออนไลน์",
        "ซื้อขายของมือสอง",
        "สินค้ามือสองราคาถูก",
        "เฟอร์นิเจอร์มือสอง",
        "โซฟามือสอง",
        "ตู้เสื้อผ้ามือสอง",
        "โต๊ะมือสอง",
        "เก้าอี้มือสอง",
        "เครื่องใช้ไฟฟ้ามือสอง",
        "power bank มือสอง",
        "เสื้อผ้ามือสอง",
        "marketplace มือสองไทย",
        "second hand thailand",
      ]
    : [
        "second hand marketplace thailand",
        "used furniture thailand",
        "used electronics thailand",
        "second hand clothes thailand",
        "buy and sell used items",
        "pre owned products thailand",
      ];

  const categoryKeywordMap = {
    furniture: isThai
      ? ["เฟอร์นิเจอร์มือสอง", "โซฟามือสอง", "ตู้เสื้อผ้ามือสอง", "โต๊ะมือสอง", "เก้าอี้มือสอง"]
      : ["used furniture", "second hand sofa", "used wardrobe", "used table", "used chair"],
    electronics: isThai
      ? ["เครื่องใช้ไฟฟ้ามือสอง", "อุปกรณ์ไอทีมือสอง", "power bank มือสอง"]
      : ["used electronics", "second hand gadgets", "used power bank"],
    fashion: isThai
      ? ["เสื้อผ้ามือสอง", "แฟชั่นมือสอง", "รองเท้ามือสอง"]
      : ["second hand clothes", "used fashion items", "pre owned shoes"],
  };

  const keywords = new Set([...baseKeywords, "ecommerce", name]);

  if (category) {
    title = isThai ? `${category} | ${name}` : `${category} products | ${name}`;
    description = isThai
      ? `เลือกซื้อ ${category} มือสองบน ${name} พร้อมสินค้าจากผู้ขายจริงทั่วไทย`
      : `Browse second hand ${category} products on ${name}.`;
    keywords.add(category);
    if (/furniture|sofa|wardrobe|table|chair|เฟอร์|โซฟา|ตู้|โต๊ะ|เก้าอี้/.test(categorySlug)) {
      for (const k of categoryKeywordMap.furniture) keywords.add(k);
    }
    if (/electronic|power|gadget|ไฟฟ้า|ไอที|พาวเวอร์/.test(categorySlug)) {
      for (const k of categoryKeywordMap.electronics) keywords.add(k);
    }
    if (/fashion|cloth|shoe|เสื้อผ้า|แฟชั่น|รองเท้า/.test(categorySlug)) {
      for (const k of categoryKeywordMap.fashion) keywords.add(k);
    }
  }

  if (q) {
    title = isThai ? `ผลการค้นหา "${q}" | ${name}` : `Search results for "${q}" | ${name}`;
    description = isThai
      ? `ผลการค้นหาสำหรับ "${q}" บน ${name}`
      : `Search results for "${q}" on ${name}.`;
    keywords.add(q);
  }

  const canonicalUrl = canonical.value;
  const ogImageLogo = `${runtimeConfig.public?.baseUrl || url.origin}/logo.svg`;

  return {
    title,
    description,
    keywords: Array.from(keywords).join(", "),
    canonicalUrl,
    ogImageLogo,
  };
});

useSeoMeta(() => ({
  title: seoContent.value.title,
  description: seoContent.value.description,
  keywords: seoContent.value.keywords,
  ogTitle: seoContent.value.title,
  ogDescription: seoContent.value.description,
  ogUrl: seoContent.value.canonicalUrl,
  ogImage: seoContent.value.ogImageLogo,
  ogType: "website",
  twitterTitle: seoContent.value.title,
  twitterDescription: seoContent.value.description,
  twitterImage: seoContent.value.ogImageLogo,
  twitterCard: "summary_large_image",
}));

const productsData = ref([]);
const visibleCount = ref(8);
const isLoading = ref(false);
const hasFetched = ref(false);
const tailEl = ref(null);
const pageInfo = ref({ hasNextPage: true, endCursor: null });

const {
  hasRemoteApi,
  endpoint,
  unwrapYardsaleResponse,
  mapApiProductRow,
  isStorefrontPublishedProduct,
} = useStorefrontCatalog();

const variables = computed(() => ({
  search: route.query.q,
  order: route.query.orderby?.toUpperCase() || "DESC",
  field: route.query.fieldby?.toUpperCase() || "DATE",
  category: route.query.category,
  after: pageInfo.value.endCursor,
}));

const lcpImageHref = computed(() => {
  const first = productsData.value?.[0];
  if (!first) return "";
  const src =
    first?.galleryImages?.nodes?.[0]?.sourceUrl ||
    first?.image?.sourceUrl ||
    "";
  return String(src || "");
});

const lcpImageSrcSet = computed(() => {
  const first = productsData.value?.[0];
  if (!first) return "";
  return String(
    first?.galleryImages?.nodes?.[0]?.srcSet ||
      first?.image?.srcSet ||
      ""
  );
});

useHead(() => ({
  link: [
    { rel: "canonical", href: seoContent.value.canonicalUrl },
    ...(lcpImageHref.value
      ? [
          {
            rel: "preload",
            as: "image",
            href: lcpImageHref.value,
            fetchpriority: "high",
            imagesrcset: lcpImageSrcSet.value || undefined,
            imagesizes:
              "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 20vw",
          },
        ]
      : []),
  ],
}));

async function fetch() {
  if (isLoading.value || !pageInfo.value.hasNextPage) return;
  isLoading.value = true;

  try {
    if (hasRemoteApi) {
      const raw = await $fetch(endpoint("products"), {
        query: {
          q: variables.value.search,
          search: variables.value.search,
          category: variables.value.category,
        },
      });
      const data = unwrapYardsaleResponse(raw);
      const rows = Array.isArray(data?.products) ? data.products : [];
      const nodes = rows
        .map((r) => mapApiProductRow(r))
        .filter((n) => isStorefrontPublishedProduct(n));
      productsData.value.push(...nodes);
      pageInfo.value = { hasNextPage: false, endCursor: null };
      hasFetched.value = true;
      return;
    }

    const response = await $fetch("/api/products", {
      query: variables.value,
    });
    const nodes = (response.products?.nodes || []).filter((n) =>
      isStorefrontPublishedProduct(n)
    );
    productsData.value.push(...nodes);
    pageInfo.value = response.products.pageInfo;
    hasFetched.value = true;
  } finally {
    isLoading.value = false;
  }
}

function revealMoreProducts(step = 8) {
  if (visibleCount.value >= productsData.value.length) return;
  visibleCount.value = Math.min(productsData.value.length, visibleCount.value + step);
}

if (import.meta.server) {
  await fetch();
} else {
  onMounted(fetch);
}

useIntervalFn(() => {
  if (!tailEl.value || isLoading.value) return;
  const { top } = tailEl.value.getBoundingClientRect();
  if (top - window.innerHeight < 400) {
    if (pageInfo.value.hasNextPage) {
      fetch();
    } else {
      revealMoreProducts(8);
    }
  }
}, 500);

watch(
  () => route.query,
  () => {
    productsData.value = [];
    visibleCount.value = 8;
    pageInfo.value = { hasNextPage: true, endCursor: null };
    fetch();
  }
);

const products = computed(() => productsData.value.slice(0, visibleCount.value));
const productsEmpty = computed(
  () => hasFetched.value && !isLoading.value && productsData.value.length === 0
);
</script>

<template>
  <div>
    <header class="sr-only">
      <h1>{{ pageHeading }}</h1>
      <h2>{{ seoContent.description }}</h2>
      <h3>Used products in Thailand</h3>
      <h4>Furniture, electronics, fashion, and home items</h4>
      <h5>Updated listings from real sellers</h5>
    </header>
    <div class="flex items-center pl-3 lg:pl-5">
      <ButtonSortBy />
    </div>
    <div
      v-if="!productsEmpty"
      class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-3 lg:gap-5 p-3 lg:p-5"
    >
      <ProductCard :products="products" />
      <ProductsSkeleton
        v-if="(!products.length || isLoading) && !productsEmpty"
      />
      <br ref="tailEl" />
    </div>
    <ProductsEmpty v-else />
  </div>
</template>
