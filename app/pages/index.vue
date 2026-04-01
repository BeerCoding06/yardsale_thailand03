<!--app/pages/index.vue-->
<script setup>
const route = useRoute();
const { name } = useAppConfig().site;
const url = useRequestURL();
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

useHead(() => {
  const q = typeof route.query.q === "string" ? route.query.q : undefined;
  const category =
    typeof route.query.category === "string" ? route.query.category : undefined;

  let title = "";
  let description = "";
  const keywords = new Set(["ecommerce", name]);

  if (category) {
    title = `${category} Products`;
    description = `Browse ${category} products on ${name}.`;
    keywords.add(category);
  }

  if (q) {
    title = `Search results for "${q}"`;
    description = `Search results for "${q}" on ${name}.`;
    keywords.add(q);
  }

  const canonicalUrl = canonical.value;
  const ogImageLogo = `${runtimeConfig.public?.baseUrl || url.origin}/logo.svg`;

  return {
    title,
    ogTitle: title,
    description,
    ogDescription: description,
    ogUrl: canonicalUrl,
    canonical: canonicalUrl,
    keywords: Array.from(keywords).join(", "),
    twitterTitle: title,
    twitterDescription: description,
    ogImage: ogImageLogo,
    twitterImage: ogImageLogo,
  };
});

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
  link: lcpImageHref.value
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
    : [],
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
