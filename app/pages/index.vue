<!--app/pages/index.vue-->
<script setup>
import { pickPagination } from "~/utils/paginationResponse";

const route = useRoute();
const router = useRouter();
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
  const p = route.query.page;
  const pageStr = Array.isArray(p) ? p[0] : p;
  if (typeof pageStr === "string" && pageStr.trim() && pageStr.trim() !== "1") {
    params.set("page", pageStr.trim());
  }
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

const PAGE_SIZE = 24;

const productsData = ref([]);
const isLoading = ref(false);
const hasFetched = ref(false);

const productPagination = ref({
  page: 1,
  page_size: PAGE_SIZE,
  total: 0,
  total_pages: 0,
});

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
}));

function currentListPage() {
  const raw = route.query.page;
  const s = String(Array.isArray(raw) ? raw[0] : raw || "1").trim();
  const n = parseInt(s, 10);
  return Math.max(1, Number.isFinite(n) ? n : 1);
}

function onProductPage(p) {
  const query = { ...route.query };
  if (p <= 1) delete query.page;
  else query.page = String(p);
  router.push({ path: route.path, query });
}

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

let loadProductsGeneration = 0;

async function loadProducts() {
  const gen = ++loadProductsGeneration;
  isLoading.value = true;

  try {
    const page = currentListPage();
    const baseQuery = {
      search: variables.value.search,
      order: variables.value.order,
      field: variables.value.field,
      category: variables.value.category,
      page,
      page_size: PAGE_SIZE,
    };

    if (hasRemoteApi) {
      const raw = await $fetch(endpoint("products"), {
        query: {
          q: variables.value.search,
          search: variables.value.search,
          category: variables.value.category,
          page,
          page_size: PAGE_SIZE,
        },
      });
      const data = unwrapYardsaleResponse(raw);
      const rows = Array.isArray(data?.products) ? data.products : [];
      const nodes = rows
        .map((r) => mapApiProductRow(r))
        .filter((n) => isStorefrontPublishedProduct(n));
      if (gen !== loadProductsGeneration) return;
      productsData.value = nodes;
      const pg = pickPagination(data);
      if (pg) {
        productPagination.value = pg;
      } else {
        productPagination.value = {
          page,
          page_size: PAGE_SIZE,
          total: nodes.length,
          total_pages: nodes.length ? 1 : 0,
        };
      }
      hasFetched.value = true;
      return;
    }

    const response = await $fetch("/api/products", {
      query: baseQuery,
    });
    if (gen !== loadProductsGeneration) return;
    const nodes = (response.products?.nodes || []).filter((n) =>
      isStorefrontPublishedProduct(n)
    );
    productsData.value = nodes;
    const pg = pickPagination(response);
    if (pg) {
      productPagination.value = pg;
    } else {
      productPagination.value = {
        page,
        page_size: PAGE_SIZE,
        total: nodes.length,
        total_pages: nodes.length ? 1 : 0,
      };
    }
    hasFetched.value = true;
  } catch (e) {
    console.error("[index] loadProducts", e);
    if (gen !== loadProductsGeneration) return;
    productsData.value = [];
    productPagination.value = {
      page: 1,
      page_size: PAGE_SIZE,
      total: 0,
      total_pages: 0,
    };
    hasFetched.value = true;
  } finally {
    if (gen === loadProductsGeneration) isLoading.value = false;
  }
}

watch(
  () => [
    String(route.query.q ?? ""),
    String(route.query.category ?? ""),
    String(route.query.orderby ?? ""),
    String(route.query.fieldby ?? ""),
  ],
  (nv, ov) => {
    if (!ov) return;
    if (nv.join("|") === ov.join("|")) return;
    if (route.query.page != null && route.query.page !== "") {
      router.replace({ path: route.path, query: { ...route.query, page: undefined } });
    }
  },
  { flush: "pre" }
);

watch(
  () => route.fullPath,
  () => {
    loadProducts();
  },
  { immediate: true }
);

const products = computed(() => productsData.value);
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
      class="space-y-4 p-3 lg:p-5"
    >
      <ListPaginationBar
        :show-search="false"
        :page="productPagination.page"
        :total-pages="productPagination.total_pages"
        :total="productPagination.total"
        :page-size="productPagination.page_size"
        :loading="isLoading"
        @update:page="onProductPage"
      />
      <div
        class="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 gap-3 lg:gap-5"
      >
        <ProductCard :products="products" />
        <ProductsSkeleton v-if="isLoading && !products.length" />
      </div>
      <ListPaginationBar
        :show-search="false"
        :page="productPagination.page"
        :total-pages="productPagination.total_pages"
        :total="productPagination.total"
        :page-size="productPagination.page_size"
        :loading="isLoading"
        @update:page="onProductPage"
      />
    </div>
    <ProductsEmpty v-else />
  </div>
</template>
