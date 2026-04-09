<!--app/pages/my-orders.vue-->
<script setup>
// แสดงเฉพาะออเดอร์ของ user ที่ login (API ใช้ JWT เท่านั้น ไม่ส่ง customer_id – เซิร์ฟเวอร์ดึงจาก token)
definePageMeta({
  middleware: "auth",
  ssr: false, // Disable SSR to prevent hydration mismatches
});

import { buildShipmentTimelineSteps } from "~/utils/shipmentTimeline";
import { pickPagination, paginationQuery } from "~/utils/paginationResponse";

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();
const localePath = useLocalePath();
const { paymentLabel, paymentColorClass, canCancelByPaymentRules, canPayOrder } =
  useCustomerPaymentStatus();
const { endpoint, hasRemoteApi } = useCmsApi();

function cmsPath(rel) {
  return hasRemoteApi ? endpoint(rel) : `/api/${rel}`;
}

function unwrapApi(res) {
  if (res?.success === true && res.data != null && typeof res.data === "object") {
    return res.data;
  }
  return res;
}

// Client-side only state
const isClient = ref(false);
const isChecking = ref(true);
const isLoading = ref(true);
const orders = ref([]);
const error = ref(null);
const cancellingOrderId = ref(null);
const cancelMessage = ref(null);
const showCancelModal = ref(false);
const orderToCancel = ref(null);

const ORDER_PAGE_SIZE = 20;
const listPage = ref(1);
const listSearch = ref("");
const orderPagination = ref({
  page: 1,
  page_size: ORDER_PAGE_SIZE,
  total: 0,
  total_pages: 0,
});

function onOrderSearch(q) {
  const tq = String(q || "").trim();
  if (tq === listSearch.value) return;
  listSearch.value = tq;
  listPage.value = 1;
  fetchOrders();
}

function onOrderPage(p) {
  if (p === listPage.value) return;
  listPage.value = p;
  fetchOrders();
}

// Format order date
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const { t } = useI18n();

const API_SHIPPING_STATUSES = [
  "pending",
  "preparing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function orderTimelinePayload(order) {
  let ship = String(order.shipping_status || "pending")
    .toLowerCase()
    .replace(/-/g, "_");
  if (!API_SHIPPING_STATUSES.includes(ship)) ship = "pending";
  return {
    status: order.status,
    shipping_status: ship,
    date_created: order.date_created || order.created_at,
    created_at: order.created_at || order.date_created,
    fulfillment_updated_at: order.fulfillment_updated_at,
  };
}

function shipmentTimelineStepsForOrder(order) {
  return buildShipmentTimelineSteps(orderTimelinePayload(order));
}

function currentShipmentTimelineLabel(order) {
  const steps = shipmentTimelineStepsForOrder(order);
  const cur = steps.find((s) => s.variant === "active");
  if (cur) return t(`order.shipment_timeline.${cur.key}`);
  const doneLast = [...steps].reverse().find((s) => s.variant === "done");
  if (doneLast) return t(`order.shipment_timeline.${doneLast.key}`);
  return t("shipping.pending");
}

// Reactive map to store product images by product_id
const productImages = ref(new Map());

// ดึงรูปจากแคตตาล็อกจำลอง (Nuxt API)
const fetchProductImageFromCatalog = async (productId) => {
  if (!productId || productImages.value.has(productId)) {
    return productImages.value.get(productId) || null;
  }

  try {
    const data = await $fetch('/api/product', { query: { id: productId } });
    const imageUrl =
      data?.product?.image?.sourceUrl ||
      data?.product?.galleryImages?.nodes?.[0]?.sourceUrl ||
      null;
    if (imageUrl) {
      productImages.value.set(productId, imageUrl);
      const newMap = new Map(productImages.value);
      productImages.value = newMap;
      return imageUrl;
    }
  } catch (error) {
    console.error(`[my-orders] Error fetching product image for product_id ${productId}:`, error);
  }

  return null;
};

// Get item image URL (ข้อมูลออเดอร์ หรือแคตตาล็อกจำลอง)
const getItemImage = (item) => {
  if (!item) return null;

  const fromApi = item.image_url != null ? String(item.image_url).trim() : "";
  if (fromApi) return fromApi;

  // First, try WooCommerce image data (immediate)
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    const img = item.images[0];
    if (img.src) return img.src;
    if (img.sourceUrl) return img.sourceUrl;
  }

  // If image is a string URL
  if (typeof item.image === 'string' && item.image.trim() !== '') {
    return item.image;
  }
  
  // If image is an object with sourceUrl
  if (item.image && typeof item.image === 'object' && item.image.sourceUrl) {
    return item.image.sourceUrl;
  }
  
  // If image is in meta_data (WooCommerce format)
  if (item.meta_data && Array.isArray(item.meta_data)) {
    const imageMeta = item.meta_data.find(meta => meta.key === '_product_image' || meta.key === 'image');
    if (imageMeta && imageMeta.value) {
      return typeof imageMeta.value === 'string' ? imageMeta.value : imageMeta.value.sourceUrl;
    }
  }
  
  // Then try WordPress REST API cache
  if (item.product_id && productImages.value.has(item.product_id)) {
    return productImages.value.get(item.product_id);
  }

  // If no image found and has product id, try to fetch from WordPress REST API (async)
  if (item.product_id && !productImages.value.has(item.product_id)) {
    fetchProductImageFromCatalog(item.product_id).catch(() => {
      // Silently fail
    });
  }
  
  return null;
};

// Computed for cancel button text
const getCancelButtonText = (orderId) => {
  return cancellingOrderId.value === orderId
    ? t("cancelling")
    : t("cancel_order");
};

// Format shipping status
const getShippingStatusText = (status) => {
  const k = String(status || "")
    .toLowerCase()
    .replace(/-/g, "_");
  const statusMap = {
    pending: t('shipping.pending'),
    preparing: t('shipping.preparing'),
    shipped: t('shipping.shipped'),
    out_for_delivery: t('shipping.out_for_delivery'),
    on_hold: t('shipping.on_hold'),
    delivered: t('shipping.delivered'),
  };
  return statusMap[k] || status;
};

const getShippingStatusColor = (status) => {
  const k = String(status || "")
    .toLowerCase()
    .replace(/-/g, "_");
  const colorMap = {
    pending:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    preparing:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    shipped:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
    out_for_delivery:
      "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
    on_hold:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
    delivered:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  };
  return (
    colorMap[k] ||
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
  );
};

const getShippingStatusIcon = (status) => {
  const k = String(status || "")
    .toLowerCase()
    .replace(/-/g, "_");
  const iconMap = {
    pending: "i-iconamoon-clock-fill",
    preparing: "i-iconamoon-package-fill",
    shipped: "i-iconamoon-truck-fill",
    out_for_delivery: "i-heroicons-map-pin",
    on_hold: "i-iconamoon-pause-circle-fill",
    delivered: "i-iconamoon-check-circle-1-fill",
  };
  return iconMap[k] || "i-iconamoon-info-circle-fill";
};

// Fetch orders
const fetchOrders = async () => {
  if (!user.value) {
    error.value = t('order.login_required');
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    const jwtToken = user.value?.token;

    if (!jwtToken) {
      error.value = t('order.login_required') + ' (JWT token missing. Please login again.)';
      isLoading.value = false;
      return;
    }

    // เรียก Yardsale GET /my-orders (หรือ /api/my-orders ตอน mock) — user จาก JWT เท่านั้น
    const raw = await $fetch(cmsPath("my-orders"), {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      query: paginationQuery(listPage.value, listSearch.value, ORDER_PAGE_SIZE),
    });
    const body = unwrapApi(raw);
    let list = Array.isArray(body?.orders)
      ? body.orders
      : Array.isArray(body?.data?.orders)
        ? body.data.orders
        : [];

    orders.value = list;

    const pg = pickPagination(body);
    if (pg) {
      orderPagination.value = pg;
    } else {
      orderPagination.value = {
        page: listPage.value,
        page_size: ORDER_PAGE_SIZE,
        total: list.length,
        total_pages: list.length ? 1 : 0,
      };
    }

    // Fetch product images from WordPress REST API for line items without images (in background)
    const productIds = new Set();
    orders.value.forEach(order => {
      if (order.line_items && Array.isArray(order.line_items)) {
        order.line_items.forEach(item => {
          const hasUrl =
            (item.image_url != null && String(item.image_url).trim() !== "") ||
            (typeof item.image === "string" && item.image.trim() !== "") ||
            (item.images && item.images.length > 0);
          if (item.product_id && !hasUrl) {
            productIds.add(item.product_id);
          }
        });
      }
    });

    // Fetch images from WordPress REST API (in background, don't wait)
    Array.from(productIds).forEach(productId => {
      fetchProductImageFromCatalog(productId).catch(() => {
        // Silently fail
      });
    });
  } catch (err) {
    console.error("[my-orders] Error fetching orders:", err);
    error.value = err?.message || t('order.error_loading');
    orders.value = [];
    orderPagination.value = {
      page: 1,
      page_size: ORDER_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    };
  } finally {
    isLoading.value = false;
  }
};

// Redirect to login if not authenticated (client-side only)
onMounted(async () => {
  isClient.value = true;

  // Wait for auth state to initialize from localStorage
  checkAuth();
  await nextTick();

  // Check authentication
  if (!isAuthenticated.value || !user.value) {
    navigateTo("/login");
    return;
  }

  isChecking.value = false;

  // Fetch orders
  await fetchOrders();
});

// Watch for auth changes
watch(isAuthenticated, (newVal) => {
  if (isClient.value && !newVal) {
    navigateTo("/login");
  }
});

// Open cancel confirmation modal
const openCancelModal = (orderId) => {
  if (!user.value) {
    cancelMessage.value = {
      type: "error",
      text: t('order.login_required'),
    };
    return;
  }
  orderToCancel.value = orderId;
  showCancelModal.value = true;
};

// Close cancel modal
const closeCancelModal = () => {
  showCancelModal.value = false;
  orderToCancel.value = null;
};

// Cancel order function
const cancelOrder = async () => {
  if (!orderToCancel.value || !user.value) {
    return;
  }

  const orderId = orderToCancel.value;
  closeCancelModal();

  try {
    cancellingOrderId.value = orderId;
    cancelMessage.value = null;

    const response = unwrapApi(
      await $fetch(cmsPath("cancel-order"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.value?.token || ""}`,
          "Content-Type": "application/json",
        },
        body: { order_id: orderId },
      })
    );

    if (response?.success !== false && (response?.success === true || response?.order != null)) {
      cancelMessage.value = {
        type: "success",
        text: t('order.cancel_success'),
      };

      // Refresh orders list
      await fetchOrders();
    }
  } catch (err) {
    console.error("[my-orders] Error cancelling order:", err);
    
    // Map error messages to i18n keys
    let errorText = t('order.cancel_error');
    const errorMessage = err?.data?.message || err?.message || '';
    
    if (errorMessage.includes('Order not found')) {
      errorText = t('order.order_not_found');
    } else if (errorMessage.includes('permission')) {
      errorText = t('order.no_permission_cancel');
    } else if (errorMessage.includes('cannot be cancelled') || errorMessage.includes('Order cannot be cancelled')) {
      if (errorMessage.includes('Only orders with status')) {
        errorText = t('order.only_pending_processing_onhold_can_cancel');
      } else {
        errorText = t('order.order_cannot_be_cancelled');
      }
    } else if (errorMessage) {
      errorText = errorMessage;
    }
    
    cancelMessage.value = {
      type: "error",
      text: errorText,
    };
  } finally {
    cancellingOrderId.value = null;
  }
};

const canCancelOrder = (order) => canCancelByPaymentRules(order);

/** ลิงก์ไปหน้าอัปโหลดสลิป (โอนเงิน) */
function payOrderLink(order) {
  const amt = order?.total_price ?? order?.total ?? "";
  return localePath({
    path: "/checkout/payment",
    query: {
      order_id: String(order?.id ?? ""),
      amount: String(amt),
    },
  });
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>
      <template v-if="isChecking || isLoading">
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">
              <span v-if="isChecking">{{ $t('order.checking_auth') }}</span>
              <span v-else>{{ $t('order.loading_orders') }}</span>
            </p>
          </div>
        </div>
      </template>
      <template v-else-if="error">
        <div class="max-w-4xl mx-auto p-6">
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center"
          >
            <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
            <button
              @click="fetchOrders"
              class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
            >
              {{ $t('order.retry') }}
            </button>
          </div>
        </div>
      </template>
      <template v-else-if="isAuthenticated && user">
        <div class="max-w-4xl mx-auto p-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-black dark:text-white">
              {{ $t('order.my_orders_title') }}
            </h1>
            <NuxtLink
              to="/"
              class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
            >
              {{ $t('order.back_to_home') }}
            </NuxtLink>
          </div>

          <ListPaginationBar
            :page="orderPagination.page"
            :total-pages="orderPagination.total_pages"
            :total="orderPagination.total"
            :page-size="orderPagination.page_size"
            :loading="isLoading"
            :search="listSearch"
            @update:page="onOrderPage"
            @update:search="onOrderSearch"
          />

          <template v-if="orders.length === 0">
            <div
              class="bg-white/80 dark:bg-black/20 rounded-2xl p-12 text-center border-2 border-neutral-200 dark:border-neutral-800"
            >
              <UIcon
                name="i-heroicons-shopping-bag"
                class="w-16 h-16 mx-auto mb-4 text-neutral-400 dark:text-neutral-600"
              />
              <p class="text-xl font-semibold text-black dark:text-white mb-2">
                {{
                  listSearch.trim()
                    ? $t('order.no_orders_search')
                    : $t('order.no_orders')
                }}
              </p>
              <p class="text-neutral-500 dark:text-neutral-400 mb-6">
                {{
                  listSearch.trim()
                    ? $t('order.no_orders_search_hint')
                    : $t('order.start_shopping')
                }}
              </p>
              <NuxtLink
                v-if="!listSearch.trim()"
                to="/"
                class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
              >
                {{ $t('order.go_shopping') }}
              </NuxtLink>
            </div>
          </template>

          <template v-else>
            <!-- Cancel Message -->
            <div
              v-if="cancelMessage"
              :class="[
                'mb-4 p-4 rounded-xl',
                cancelMessage.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
              ]"
            >
              {{ cancelMessage.text }}
            </div>

            <div class="space-y-4">
              <div
                v-for="order in orders"
                :key="order.id"
                class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
              >
                <div
                  class="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div class="flex-1">
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
                      <h3
                        class="text-lg font-semibold text-black dark:text-white"
                      >
                        {{ $t('order.order_id') }}{{ order.number || order.id }}
                      </h3>
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="text-xs font-medium text-neutral-500 dark:text-neutral-400"
                          >{{ $t('order.payment_status_customer') }}</span
                        >
                        <span
                          :class="[
                            'px-3 py-1 rounded-full text-xs font-semibold',
                            paymentColorClass(order),
                          ]"
                        >
                          {{ paymentLabel(order) }}
                        </span>
                      </div>
                    </div>
                    <p
                      class="text-sm text-neutral-600 dark:text-neutral-400 mb-2"
                    >
                      {{ $t('order.date') }} {{ formatDate(order.date_created) }}
                    </p>
                    <p class="text-sm text-neutral-600 dark:text-neutral-400">
                      {{ $t('order.total_amount') }}
                      <span
                        class="font-semibold text-alizarin-crimson-600 dark:text-alizarin-crimson-500"
                        >฿{{ parseFloat((order.total_price ?? order.total) || 0).toFixed(2) }}</span
                      >
                    </p>
                    <p
                      v-if="order.payment_method_title"
                      class="text-sm text-neutral-600 dark:text-neutral-400"
                    >
                      {{ $t('order.payment_method') }} {{ order.payment_method_title }}
                    </p>
                  </div>

                  <div class="flex flex-col sm:flex-row gap-2">
                    <NuxtLink
                      v-if="canPayOrder(order)"
                      :to="payOrderLink(order)"
                      class="px-4 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg text-center"
                    >
                      {{ $t('order.pay_now') }}
                    </NuxtLink>
                    <NuxtLink
                      :to="`/order/${order.id}`"
                      class="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-xl font-semibold hover:bg-green-700 dark:hover:bg-green-600 transition shadow-lg text-center"
                    >
                      {{ $t('order.view_details') }}
                    </NuxtLink>
                    <button
                      v-if="canCancelOrder(order)"
                      @click="openCancelModal(order.id)"
                      :disabled="cancellingOrderId === order.id"
                      class="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-xl font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <UIcon
                        v-if="cancellingOrderId === order.id"
                        name="i-heroicons-arrow-path"
                        class="w-4 h-4 animate-spin"
                      />
                      <UIcon
                        v-else
                        name="i-heroicons-x-circle"
                        class="w-4 h-4"
                      />
                      <template v-if="cancellingOrderId === order.id">
                        <span>{{ $t('order.cancelling') }}</span>
                      </template>
                      <template v-else>
                        <span>{{ $t('order.cancel_order') }}</span>
                      </template>
                    </button>
                  </div>
                </div>

                <!-- Shipping Status - Progress Bar Steps -->
                <div
                  v-if="order.shipping_status"
                  class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
                >
                  <div
                    class="mb-4 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 border-2 border-neutral-200 dark:border-neutral-800"
                  >
                    <div class="mb-4">
                      <div class="flex items-center gap-2 mb-3">
                        <p
                          class="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
                        >
                          {{ $t('order.shipping_status') }}
                        </p>
                        <span
                          :class="[
                            'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1',
                            getShippingStatusColor(order.shipping_status),
                          ]"
                        >
                          <UIcon
                            :name="getShippingStatusIcon(order.shipping_status)"
                            class="w-4 h-4"
                          />
                          {{ getShippingStatusText(order.shipping_status) }}
                        </span>
                      </div>
                      <ShipmentTimeline
                        class="mt-1"
                        :steps="shipmentTimelineStepsForOrder(order)"
                      />
                    </div>

                    <!-- Summary -->
                    <div
                      class="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <div>
                        <p
                          class="text-xs text-neutral-500 dark:text-neutral-600 mb-1"
                        >
                          {{ $t('order.current_step') }}
                        </p>
                        <p
                          class="text-sm font-semibold text-black dark:text-white"
                        >
                          {{ currentShipmentTimelineLabel(order) }}
                        </p>
                      </div>
                      <div v-if="order.tracking_number" class="text-right">
                        <p
                          class="text-xs text-neutral-500 dark:text-neutral-600 mb-1"
                        >
                          {{ $t('order.tracking_from_seller') }}
                        </p>
                        <p
                          class="text-sm font-mono font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
                        >
                          {{ order.tracking_number }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Shipping Details -->
                  <div class="space-y-2 text-sm">
                    <p
                      v-if="
                        order.shipping_methods &&
                        order.shipping_methods.length > 0
                      "
                      class="text-neutral-600 dark:text-neutral-400"
                    >
                      <span class="font-semibold">{{ $t('order.shipping_method_label') }}</span>
                      {{ order.shipping_methods[0].method_title || $t('common.not_available') }}
                    </p>
                    <p
                      v-if="order.date_shipped"
                      class="text-neutral-600 dark:text-neutral-400"
                    >
                      <span class="font-semibold">{{ $t('order.shipping_date_label') }}</span>
                      {{ formatDate(order.date_shipped) }}
                    </p>
                  </div>

                  <!-- Shipping Address -->
                  <div
                    v-if="
                      order.shipping_address && order.shipping_address.address_1
                    "
                    class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <p
                      class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2"
                    >
                      {{ $t('order.shipping_address_label') }}
                    </p>
                    <div
                      class="text-sm text-neutral-600 dark:text-neutral-400 space-y-1"
                    >
                      <p>
                        {{ order.shipping_address.real_first_name || order.shipping_address.first_name }}
                        {{ order.shipping_address.real_last_name || order.shipping_address.last_name }}
                      </p>
                      <p>{{ order.shipping_address.address_1 }}</p>
                      <p v-if="order.shipping_address.address_2">
                        {{ order.shipping_address.address_2 }}
                      </p>
                      <p>
                        {{ order.shipping_address.city }}
                        <span v-if="order.shipping_address.state">
                          , {{ order.shipping_address.state }}
                        </span>
                        <span v-if="order.shipping_address.postcode">
                          {{ order.shipping_address.postcode }}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Order Items Preview -->
                <div
                  v-if="order.line_items && order.line_items.length > 0"
                  class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
                >
                  <p
                    class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2"
                  >
                    {{ $t('order.order_items') }}
                  </p>
                  <div class="flex flex-wrap gap-3">
                    <div
                      v-for="(item, index) in order.line_items.slice(0, 3)"
                      :key="index"
                      class="flex items-center gap-3 text-sm"
                    >
                      <StorefrontImg
                        v-if="getItemImage(item)"
                        :src="getItemImage(item)"
                        :alt="item.name || $t('common.product')"
                        class="w-12 h-12 object-cover rounded-lg border-2 border-neutral-200 dark:border-neutral-700"
                        loading="lazy"
                      />
                      <div
                        v-else
                        class="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-lg flex items-center justify-center"
                      >
                        <UIcon
                          name="i-heroicons-photo"
                          class="w-6 h-6 text-neutral-400 dark:text-neutral-500"
                        />
                      </div>
                      <div class="flex flex-col">
                        <span
                          class="text-neutral-600 dark:text-neutral-400 font-medium"
                          >{{ item.name }}</span
                        >
                        <span
                          class="text-neutral-400 dark:text-neutral-600 text-xs"
                          >x{{ item.quantity }}</span
                        >
                      </div>
                    </div>
                    <span
                      v-if="order.line_items.length > 3"
                      class="text-sm text-neutral-500 dark:text-neutral-400 self-center"
                    >
                      {{ $t('order.and_more_items', { count: order.line_items.length - 3 }) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400 mb-4">
              {{ $t('order.login_required_message') }}
            </p>
            <NuxtLink
              to="/login"
              class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
            >
              {{ $t('auth.login') }}
            </NuxtLink>
          </div>
        </div>
      </template>
      <template #fallback>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">{{ $t('general.loading') }}</p>
          </div>
        </div>
      </template>
    </ClientOnly>

    <!-- Cancel Order Confirmation Modal -->
    <UModal v-model="showCancelModal" :ui="{
      overlay: {
        background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
      },
      width: 'w-full sm:max-w-md',
    }">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-black dark:text-white">
            {{ $t('order.cancel_order') }}
          </h3>
          <button
            @click="closeCancelModal"
            class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
          >
            <UIcon
              name="i-heroicons-x-mark"
              class="w-5 h-5 text-neutral-500 dark:text-neutral-400"
            />
          </button>
        </div>

        <div class="mb-6">
          <div class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            <UIcon
              name="i-heroicons-exclamation-triangle"
              class="w-8 h-8 text-red-600 dark:text-red-400"
            />
          </div>
          <p class="text-center text-neutral-700 dark:text-neutral-300 text-base">
            {{ $t('order.cancel_order_confirm') }}
          </p>
        </div>

        <div class="flex gap-3">
          <button
            @click="closeCancelModal"
            class="flex-1 px-4 py-3 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
          >
            {{ $t('profile.cancel') }}
          </button>
          <button
            @click="cancelOrder"
            class="flex-1 px-4 py-3 bg-red-600 dark:bg-red-500 text-white rounded-xl font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition shadow-lg flex items-center justify-center gap-2"
          >
            <UIcon
              name="i-heroicons-x-circle"
              class="w-5 h-5"
            />
            {{ $t('order.cancel_order') }}
          </button>
        </div>
      </div>
    </UModal>
  </div>
</template>
