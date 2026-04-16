<!--app/pages/my-products.vue-->
<script setup lang="ts">
import { push } from "notivue";
import { useCmsApi } from "#imports";
import { pickPagination, paginationQuery } from "~/utils/paginationResponse";
import { unwrapYardsaleResponse } from "~/utils/cmsApiEndpoint";

// แสดงเฉพาะสินค้าของ user ที่ login (API ใช้ JWT เท่านั้น ไม่ส่ง user_id – เซิร์ฟเวอร์ดึงจาก token)
definePageMeta({
  middleware: "seller",
  ssr: false, // Disable SSR to prevent hydration mismatch
});

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();
const { hasRemoteApi } = useCmsApi();
const { fetchYardsale, resolveMediaUrl } = useStorefrontCatalog();

function localMyProductsApiPath(rel: string) {
  return `/api/${rel}`;
}

function parseModerationFeedback(raw: unknown) {
  let v = raw;
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const issues = Array.isArray(o.issues)
    ? o.issues.filter((x): x is string => typeof x === "string")
    : [];
  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (!issues.length && !message) return null;
  const at = typeof o.at === "string" ? o.at : null;
  return {
    issues,
    message,
    at,
  };
}

/** Express: listing_status + is_cancelled / price / created_at */
function normalizeMyProduct(p: any) {
  if (!p || typeof p !== "object") return p;
  const cancelled = p.is_cancelled === true;
  const ls = p.listing_status || "published";
  let status: string;
  if (cancelled) status = "cancelled";
  else if (ls === "published") status = "publish";
  else if (ls === "hidden") status = "hidden";
  else status = "pending";
  return {
    ...p,
    status: p.status ?? status,
    regular_price: p.regular_price ?? p.price,
    stock_quantity: p.stock_quantity ?? p.stock,
    manage_stock: p.manage_stock ?? true,
    date_created: p.date_created ?? p.created_at,
    moderation: parseModerationFeedback(p.moderation_feedback),
  };
}

// Client-side only state to prevent hydration mismatch
const isClient = ref(false);
const isLoading = ref(true);
const products = ref<any[]>([]);
const error = ref<string | null>(null);

// Confirm modal state
const showCancelModal = ref(false);
const showRestoreModal = ref(false);
const productToCancel = ref<string | number | null>(null);
const productToRestore = ref<string | number | null>(null);
const isCancelling = ref(false);
const isRestoring = ref(false);

const MODERATION_TOAST_SIG_KEY = "yardsale_my_products_moderation_sig";

const PRODUCT_PAGE_SIZE = 20;
const listPage = ref(1);
const listSearch = ref("");
const productPagination = ref({
  page: 1,
  page_size: PRODUCT_PAGE_SIZE,
  total: 0,
  total_pages: 0,
});

function onProductSearch(q: string) {
  const tq = String(q || "").trim();
  if (tq === listSearch.value) return;
  listSearch.value = tq;
  listPage.value = 1;
  fetchProducts();
}

function onProductPage(p: number) {
  if (p === listPage.value) return;
  listPage.value = p;
  fetchProducts();
}

const { t, locale } = useI18n();

function moderationIssueLabel(key: string) {
  const path = `my_products.moderation_issue_${key}`;
  const translated = t(path);
  return translated === path ? key : translated;
}

const moderationProductCount = computed(
  () => products.value.filter((p: any) => p?.moderation).length
);

function moderationFeedbackSignature(list: any[]) {
  const ids = list
    .filter((p) => p?.moderation)
    .map((p) => String(p.id))
    .sort();
  return ids.join(",");
}

function maybePushModerationToast() {
  if (!import.meta.client) return;
  const moderated = products.value.filter((p: any) => p?.moderation);
  if (moderated.length === 0) return;
  const sig = moderationFeedbackSignature(products.value);
  try {
    const prev = sessionStorage.getItem(MODERATION_TOAST_SIG_KEY);
    if (prev === sig) return;
    sessionStorage.setItem(MODERATION_TOAST_SIG_KEY, sig);
  } catch {
    /* private mode */
  }
  push.warning(t("my_products.moderation_toast", { n: moderated.length }));
}

function formatModerationAt(iso: unknown) {
  if (iso == null || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(String(locale.value || "th").startsWith("th") ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Get product image URL from WooCommerce data
const getProductImage = (product: any) => {
  if (!product) return null;

  if (product.image_url && typeof product.image_url === "string") {
    return product.image_url;
  }

  // Try WooCommerce images array
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const img = product.images[0];
    if (img.src) return img.src;
    if (img.sourceUrl) return img.sourceUrl;
  }

  // Try product.image object
  if (product.image) {
    if (typeof product.image === 'string') {
      return product.image;
    }
    if (product.image.sourceUrl) {
      return product.image.sourceUrl;
    }
  }

  return null;
};

/** รูปจาก API มักเป็น `/uploads/...` — ต้องใช้ origin ของ backend ไม่ใช่พอร์ต Nuxt */
function productImageDisplayUrl(product: any): string | null {
  const raw = getProductImage(product);
  if (!raw || typeof raw !== "string") return null;
  if (hasRemoteApi) return resolveMediaUrl(raw) ?? raw;
  return raw;
}

// Fetch user's products
const fetchProducts = async () => {
  if (!user.value || !user.value.id) {
    error.value = t('auth.login_required');
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    // Get JWT token from user object (stored during login)
    const jwtToken = user.value?.token;
    
    if (!jwtToken) {
      error.value = t('auth.login_required') + ' (JWT token missing. Please login again.)';
      isLoading.value = false;
      return;
    }

    // หน้าร้าน: own_only=1 — แม้ role admin ก็เห็นเฉพาะสินค้าของบัญชีนี้ (รายการทั้งระบบใช้แอดมิน /admin/products)
    const listQuery = {
      own_only: "1",
      ...paginationQuery(listPage.value, listSearch.value, PRODUCT_PAGE_SIZE),
    };
    const listHeaders = { Authorization: `Bearer ${jwtToken}` };
    let response: any;
    if (hasRemoteApi) {
      response = await fetchYardsale("my-products", {
        headers: listHeaders,
        query: listQuery,
      });
    } else {
      const raw = await $fetch(localMyProductsApiPath("my-products"), {
        headers: listHeaders,
        query: listQuery,
      });
      response = unwrapYardsaleResponse(raw) ?? raw;
    }
    const requestedAsUserId = (response as any)?.requested_as_user_id;
    if (requestedAsUserId != null) {
      if (user.value?.id != null && Number(user.value.id) !== Number(requestedAsUserId)) {
        console.warn("[my-products] ไม่ตรงกัน: JWT ใน token อาจไม่ตรงกับ user ที่ login (ให้ logout แล้ว login ใหม่)");
      }
    }

    if (response && response.success !== false) {
      if (Array.isArray(response)) {
        products.value = response.map(normalizeMyProduct);
        productPagination.value = {
          page: listPage.value,
          page_size: PRODUCT_PAGE_SIZE,
          total: products.value.length,
          total_pages: products.value.length ? 1 : 0,
        };
      } else if (response.products && Array.isArray(response.products)) {
        products.value = response.products.map(normalizeMyProduct);
        const pg = pickPagination(response);
        if (pg) {
          productPagination.value = pg;
        } else {
          productPagination.value = {
            page: listPage.value,
            page_size: PRODUCT_PAGE_SIZE,
            total: products.value.length,
            total_pages: products.value.length ? 1 : 0,
          };
        }
      } else {
        products.value = [];
        error.value = t('my_products.no_products_found');
        productPagination.value = {
          page: 1,
          page_size: PRODUCT_PAGE_SIZE,
          total: 0,
          total_pages: 0,
        };
      }
    } else {
      products.value = [];
      productPagination.value = {
        page: 1,
        page_size: PRODUCT_PAGE_SIZE,
        total: 0,
        total_pages: 0,
      };
      error.value =
        (response as any)?.error?.message ||
        (response as any)?.error ||
        (response as any)?.message ||
        t('my_products.no_products_found');
    }
  } catch (err) {
    console.error("[my-products] Error fetching products:", err);
    const errorObj = err as any;
    products.value = [];
    productPagination.value = {
      page: 1,
      page_size: PRODUCT_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    };
    error.value =
      errorObj?.data?.error?.message ||
      errorObj?.data?.message ||
      errorObj?.message ||
      t('my_products.load_error');
  } finally {
    isLoading.value = false;
    if (!error.value && products.value.length) {
      nextTick(() => maybePushModerationToast());
    }
  }
};

// Open cancel product modal
const openCancelModal = (productId: string | number) => {
  productToCancel.value = productId;
  showCancelModal.value = true;
};

// Close cancel modal
const closeCancelModal = () => {
  showCancelModal.value = false;
  productToCancel.value = null;
};

// Cancel product (เปลี่ยนสถานะเป็น draft)
const cancelProduct = async () => {
  if (!user.value || !user.value.id || !productToCancel.value) {
    closeCancelModal();
    return;
  }

  const productId = productToCancel.value;

  try {
    isCancelling.value = true;
    const jwtToken = user.value?.token;
    let response: any;
    if (hasRemoteApi) {
      response = await fetchYardsale("product/cancel", {
        method: "POST",
        headers: {
          ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: { product_id: String(productId) },
      });
    } else {
      const raw = await $fetch(localMyProductsApiPath("cancel-product"), {
        method: "POST",
        headers: {
          ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: { product_id: productId, user_id: user.value.id },
      } as any);
      response = unwrapYardsaleResponse(raw) ?? raw;
    }
    const ok = response?.product != null || response?.success === true;
    if (ok) {
      const newStatus = response?.product?.status ?? "cancelled";
      products.value = products.value.map((p: any) =>
        p.id === productId || String(p.id) === String(productId)
          ? {
              ...p,
              status: newStatus,
              is_cancelled: response?.product?.is_cancelled ?? true,
            }
          : p
      );
      push.success(t('product.cancel_success'));
    } else {
      push.error(t('product.cancel_error'));
    }
  } catch (err) {
    console.error("[my-products] Error cancelling product:", err);
    const errorObj = err as any;
    push.error(
      errorObj?.data?.message ||
        errorObj?.message ||
        t('product.cancel_error')
    );
  } finally {
    isCancelling.value = false;
    closeCancelModal();
  }
};

// Open restore product modal
const openRestoreModal = (productId: string | number) => {
  productToRestore.value = productId;
  showRestoreModal.value = true;
};

// Close restore modal
const closeRestoreModal = () => {
  showRestoreModal.value = false;
  productToRestore.value = null;
};

// Restore product (เปลี่ยนสถานะกลับเป็น publish)
const restoreProduct = async () => {
  if (!user.value || !user.value.id || !productToRestore.value) {
    closeRestoreModal();
    return;
  }

  const productId = productToRestore.value;

  try {
    isRestoring.value = true;
    const jwtToken = user.value?.token;
    let response: any;
    if (hasRemoteApi) {
      response = await fetchYardsale("product/restore", {
        method: "POST",
        headers: {
          ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: { product_id: String(productId) },
      });
    } else {
      const raw = await $fetch(localMyProductsApiPath("restore-product"), {
        method: "POST",
        headers: {
          ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: { product_id: productId, user_id: user.value.id },
      } as any);
      response = unwrapYardsaleResponse(raw) ?? raw;
    }
    const ok = response?.product != null || response?.success === true;
    if (ok) {
      const newStatus = response?.product?.status ?? "publish";
      products.value = products.value.map((p: any) =>
        p.id === productId || String(p.id) === String(productId)
          ? {
              ...p,
              status: newStatus,
              is_cancelled: response?.product?.is_cancelled ?? false,
            }
          : p
      );
      push.success(t('product.restore_success'));
    } else {
      push.error(t('product.restore_error'));
    }
  } catch (err) {
    console.error("[my-products] Error restoring product:", err);
    const errorObj = err as any;
    push.error(
      errorObj?.data?.message ||
        errorObj?.message ||
        t('product.restore_error')
    );
  } finally {
    isRestoring.value = false;
    closeRestoreModal();
  }
};

// Redirect to login if not authenticated (client-side only)
onMounted(async () => {
  isClient.value = true;

  // Check auth state first (client-side only)
  if (typeof window !== "undefined") {
    checkAuth();
  }

  // Wait for auth state to initialize from localStorage
  await nextTick();

  // Check authentication
  if (!isAuthenticated.value || !user.value) {
    navigateTo("/login");
    return;
  }

  // Fetch products
  await fetchProducts();
});

// Watch for auth changes
watch(isAuthenticated, (newVal: boolean) => {
  if (isClient.value && !newVal) {
    navigateTo("/login");
  }
});
</script>

<template>
  <ClientOnly>
    <div class="min-h-screen bg-neutral-50 dark:bg-black">
      <div class="max-w-7xl mx-auto p-6">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-3xl font-bold text-black dark:text-white">
            {{ $t('auth.my_products') }}
          </h1>
          <NuxtLink
            to="/create-product"
            class="flex items-center gap-2 px-4 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
          >
            <UIcon name="i-heroicons-plus-circle" class="w-5 h-5" />
            <span>{{ $t('my_products.create_new') }}</span>
          </NuxtLink>
        </div>

        <div
          v-if="!isLoading && !error && moderationProductCount > 0"
          class="mb-6 flex gap-3 rounded-2xl border-2 border-alizarin-crimson-300 bg-alizarin-crimson-50 p-4 shadow-md dark:border-alizarin-crimson-800 dark:bg-alizarin-crimson-950/40"
          role="status"
        >
          <UIcon
            name="i-heroicons-shield-exclamation"
            class="mt-0.5 h-8 w-8 shrink-0 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
          />
          <div class="min-w-0">
            <p class="font-bold text-alizarin-crimson-900 dark:text-alizarin-crimson-100">
              {{ $t("my_products.moderation_banner_title") }}
            </p>
            <p class="mt-1 text-sm text-alizarin-crimson-800 dark:text-alizarin-crimson-200">
              {{ $t("my_products.moderation_banner_body", { n: moderationProductCount }) }}
            </p>
            <p class="mt-2 text-xs text-alizarin-crimson-700/90 dark:text-alizarin-crimson-300/90">
              {{ $t("my_products.moderation_banner_hint") }}
            </p>
          </div>
        </div>

        <ListPaginationBar
          v-if="!isLoading && !error"
          :page="productPagination.page"
          :total-pages="productPagination.total_pages"
          :total="productPagination.total"
          :page-size="productPagination.page_size"
          :loading="isLoading"
          :search="listSearch"
          @update:page="onProductPage"
          @update:search="onProductSearch"
        />

        <template v-if="isLoading">
          <div class="flex items-center justify-center py-12">
            <div class="text-center">
              <p class="text-neutral-500 dark:text-neutral-400">
                {{ $t('my_products.loading') }}
              </p>
            </div>
          </div>
        </template>

        <template v-else-if="error">
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center"
          >
            <p class="text-red-600 dark:text-red-400">{{ error }}</p>
          </div>
        </template>

        <template v-else-if="products.length === 0">
          <div
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-12 text-center border-2 border-neutral-200 dark:border-neutral-800"
          >
            <UIcon
              name="i-heroicons-cube-transparent"
              class="w-16 h-16 mx-auto mb-4 text-neutral-400 dark:text-neutral-600"
            />
            <p class="text-xl font-semibold text-black dark:text-white mb-2">
              {{
                listSearch.trim()
                  ? $t('my_products.no_products_search')
                  : $t('my_products.no_products')
              }}
            </p>
            <p class="text-neutral-500 dark:text-neutral-400 mb-6">
              {{
                listSearch.trim()
                  ? $t('my_products.no_products_search_hint')
                  : $t('my_products.start_creating')
              }}
            </p>
            <NuxtLink
              v-if="!listSearch.trim()"
              to="/create-product"
              class="inline-flex items-center gap-2 px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
            >
              <UIcon name="i-heroicons-plus-circle" class="w-5 h-5" />
              <span>{{ $t('my_products.create_new') }}</span>
            </NuxtLink>
          </div>
        </template>

        <template v-else>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="product in products"
              :key="product.id"
              class="bg-white/80 dark:bg-black/20 rounded-2xl overflow-hidden shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
            >
              <!-- Product Image -->
              <div
                class="relative aspect-square bg-neutral-100 dark:bg-neutral-900"
              >
                <StorefrontImg
                  v-if="productImageDisplayUrl(product)"
                  :src="productImageDisplayUrl(product) ?? ''"
                  :alt="product.name"
                  class="w-full h-[300px] object-cover"
                  loading="lazy"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center"
                >
                  <UIcon
                    name="i-heroicons-photo"
                    class="w-16 h-16 text-neutral-400 dark:text-neutral-600"
                  />
                </div>
                <!-- Status Badge -->
                <div
                  v-if="product.moderation"
                  class="absolute top-2 left-2 max-w-[calc(100%-5rem)] px-2.5 py-1 rounded-full text-xs font-bold bg-alizarin-crimson-600 text-white shadow-md dark:bg-alizarin-crimson-500"
                >
                  {{ $t("my_products.moderation_badge") }}
                </div>
                <div
                  class="absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-yellow-500 text-white': product.status === 'pending',
                    'bg-green-500 text-white': product.status === 'publish',
                    'bg-neutral-600 text-white': product.status === 'hidden',
                    'bg-red-500 text-white': product.status === 'cancelled',
                  }"
                >
                  {{
                    product.status === "pending"
                      ? $t('my_products.status.pending')
                      : product.status === "publish"
                      ? $t('my_products.status.published')
                      : product.status === "hidden"
                      ? $t('my_products.status.hidden')
                      : $t('my_products.status.cancelled')
                  }}
                </div>
              </div>

              <!-- Product Info -->
              <div class="p-4">
                <h3
                  class="text-lg font-semibold text-black dark:text-white mb-2 line-clamp-2"
                >
                  {{ product.name }}
                </h3>

                <div
                  v-if="product.moderation"
                  class="mb-3 rounded-xl border-2 border-alizarin-crimson-200 bg-white/90 p-3 text-sm shadow-sm dark:border-alizarin-crimson-900 dark:bg-alizarin-crimson-950/30 dark:text-alizarin-crimson-50"
                >
                  <div class="flex items-start gap-2 border-l-4 border-alizarin-crimson-600 pl-3 dark:border-alizarin-crimson-400">
                    <UIcon
                      name="i-heroicons-chat-bubble-left-ellipsis"
                      class="mt-0.5 h-5 w-5 shrink-0 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="font-bold text-alizarin-crimson-900 dark:text-alizarin-crimson-100">
                        {{ $t("my_products.moderation_notice_title") }}
                      </p>
                      <p
                        v-if="product.moderation.at && formatModerationAt(product.moderation.at)"
                        class="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400"
                      >
                        {{ $t("my_products.moderation_reviewed_at") }}:
                        {{ formatModerationAt(product.moderation.at) }}
                      </p>
                      <p class="mt-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {{ $t("my_products.moderation_action_hint") }}
                      </p>
                      <ul
                        v-if="product.moderation.issues.length"
                        class="mt-2 list-disc space-y-0.5 ps-4 text-neutral-900 dark:text-neutral-100"
                      >
                        <li
                          v-for="issue in product.moderation.issues"
                          :key="issue"
                        >
                          {{ moderationIssueLabel(issue) }}
                        </li>
                      </ul>
                      <p
                        v-if="product.moderation.message"
                        class="mt-2 whitespace-pre-wrap text-neutral-800 dark:text-neutral-200"
                      >
                        {{ product.moderation.message }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 mb-3">
                  <span
                    v-if="product.sale_price"
                    class="text-2xl font-bold text-red-600 dark:text-red-400"
                  >
                    {{ product.sale_price }} ฿
                  </span>
                  <span
                    :class="[
                      'text-xl font-semibold',
                      product.sale_price
                        ? 'text-neutral-400 dark:text-neutral-500 line-through'
                        : 'text-black dark:text-white',
                    ]"
                  >
                    {{ product.regular_price || product.price }} ฿
                  </span>
                </div>

                <!-- Product Meta -->
                <div
                  class="space-y-2 text-sm text-neutral-500 dark:text-neutral-400"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-cube" class="w-4 h-4" />
                    <span>{{ $t('product.sku') }}: {{ product.sku || $t('my_products.na') }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-archive-box" class="w-4 h-4" />
                    <span>
                      {{ $t('cart.stock') }}:
                      {{
                        product.manage_stock
                          ? product.stock_quantity || 0
                          : $t('my_products.unlimited')
                      }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                    <span>
                      {{ $t('my_products.created_at') }}:
                      {{
                        new Date(product.date_created).toLocaleDateString(
                          "th-TH"
                        )
                      }}
                    </span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="mt-4 flex gap-2">
                  <NuxtLink
                    :to="`/product/${product.id}`"
                    class="flex-1 text-center px-4 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-lg font-medium hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
                  >
                    {{ $t('my_products.view_product') }}
                  </NuxtLink>
                  <NuxtLink
                    :to="`/edit-product/${product.id}`"
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    {{ $t('my_products.edit') }}
                  </NuxtLink>
                  <button
                    v-if="product.status === 'cancelled'"
                    @click="openRestoreModal(product.id)"
                    class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    {{ $t('product.restore') }}
                  </button>
                  <button
                    v-else-if="product.status !== 'hidden'"
                    @click="openCancelModal(product.id)"
                    class="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                  >
                    {{ $t('product.cancel') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <template #fallback>
      <div class="min-h-screen bg-neutral-50 dark:bg-black">
        <div class="max-w-7xl mx-auto p-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-black dark:text-white">
              {{ $t('auth.my_products') }}
            </h1>
          </div>
          <div class="flex items-center justify-center py-12">
            <div class="text-center">
              <p class="text-neutral-500 dark:text-neutral-400">{{ $t('general.loading') }}</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </ClientOnly>

  <!-- Cancel Product Confirmation Modal -->
  <ConfirmModal
    v-model="showCancelModal"
    :title="$t('product.cancel_confirm_title')"
    :message="$t('product.cancel_confirm_message')"
    :confirm-text="$t('product.cancel')"
    :cancel-text="$t('general.cancel')"
    confirm-color="red"
    :loading="isCancelling"
    @confirm="cancelProduct"
    @cancel="closeCancelModal"
  />

  <!-- Restore Product Confirmation Modal -->
  <ConfirmModal
    v-model="showRestoreModal"
    :title="$t('product.restore_confirm_title')"
    :message="$t('product.restore_confirm_message')"
    :confirm-text="$t('product.restore')"
    :cancel-text="$t('general.cancel')"
    confirm-color="green"
    :loading="isRestoring"
    @confirm="restoreProduct"
    @cancel="closeRestoreModal"
  />
</template>
