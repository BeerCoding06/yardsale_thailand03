<!--app/pages/my-products.vue-->
<script setup lang="ts">
import { push } from "notivue";
import { useCmsApi } from "#imports";

// แสดงเฉพาะสินค้าของ user ที่ login (API ใช้ JWT เท่านั้น ไม่ส่ง user_id – เซิร์ฟเวอร์ดึงจาก token)
definePageMeta({
  middleware: "auth",
  ssr: false, // Disable SSR to prevent hydration mismatch
});

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();
const { endpoint, hasRemoteApi } = useCmsApi();
const { resolveMediaUrl } = useStorefrontCatalog();

function cmsPath(rel: string) {
  return hasRemoteApi ? endpoint(rel) : `/api/${rel}`;
}

function unwrapApi(res: any) {
  if (res?.success === true && res.data != null && typeof res.data === "object") {
    return res.data;
  }
  return res;
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

const { t } = useI18n();

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
    const base = cmsPath("my-products");
    const sep = base.includes("?") ? "&" : "?";
    const url = `${base}${sep}own_only=1`;
    const raw = await $fetch(url, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    const response = unwrapApi(raw);
    const requestedAsUserId = (response as any)?.requested_as_user_id;
    if (requestedAsUserId != null) {
      if (user.value?.id != null && Number(user.value.id) !== Number(requestedAsUserId)) {
        console.warn("[my-products] ไม่ตรงกัน: JWT ใน token อาจไม่ตรงกับ user ที่ login (ให้ logout แล้ว login ใหม่)");
      }
    }

    if (response && response.success !== false) {
      if (Array.isArray(response)) {
        products.value = response.map(normalizeMyProduct);
      } else if (response.products && Array.isArray(response.products)) {
        products.value = response.products.map(normalizeMyProduct);
      } else {
        products.value = [];
        error.value = t('my_products.no_products_found');
      }
    } else {
      products.value = [];
      error.value =
        (response as any)?.error?.message ||
        (response as any)?.error ||
        (response as any)?.message ||
        t('my_products.no_products_found');
    }
  } catch (err) {
    console.error("[my-products] Error fetching products:", err);
    const errorObj = err as any;
    error.value =
      errorObj?.data?.error?.message ||
      errorObj?.data?.message ||
      errorObj?.message ||
      t('my_products.load_error');
  } finally {
    isLoading.value = false;
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
    const cancelPath = hasRemoteApi ? "product/cancel" : "cancel-product";
    const raw = await $fetch(cmsPath(cancelPath), {
      method: "POST",
      headers: {
        ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
        "Content-Type": "application/json",
      },
      body: hasRemoteApi
        ? { product_id: String(productId) }
        : { product_id: productId, user_id: user.value.id },
    } as any);

    const response = unwrapApi(raw);
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
    const restorePath = hasRemoteApi ? "product/restore" : "restore-product";
    const raw = await $fetch(cmsPath(restorePath), {
      method: "POST",
      headers: {
        ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
        "Content-Type": "application/json",
      },
      body: hasRemoteApi
        ? { product_id: String(productId) }
        : { product_id: productId, user_id: user.value.id },
    } as any);

    const response = unwrapApi(raw);
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
              {{ $t('my_products.no_products') }}
            </p>
            <p class="text-neutral-500 dark:text-neutral-400 mb-6">
              {{ $t('my_products.start_creating') }}
            </p>
            <NuxtLink
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
