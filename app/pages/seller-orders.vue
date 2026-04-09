<!--app/pages/seller-orders.vue-->
<script setup>
import { push } from "notivue";
import { buildShipmentTimelineSteps } from "~/utils/shipmentTimeline";
import { pickPagination, paginationQuery } from "~/utils/paginationResponse";

definePageMeta({
  middleware: "seller",
  ssr: false,
});

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();
const { endpoint, hasRemoteApi } = useCmsApi();
const { paymentLabel, paymentColorClass } = useCustomerPaymentStatus();

const isClient = ref(false);
const isLoading = ref(true);
const orders = ref([]);
const error = ref(null);
/** แบบร่างอัปเดตจัดส่งต่อออเดอร์ — key = order.id */
const fulfillmentDrafts = ref({});
const savingFulfillmentId = ref(null);

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

function cmsPath(rel) {
  return hasRemoteApi ? endpoint(rel) : `/api/${rel}`;
}

function unwrapApi(res) {
  if (res?.success === true && res.data != null && typeof res.data === "object") {
    return res.data;
  }
  return res;
}

function normalizeStatusKey(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/-/g, "_");
}

function orderPaid(order) {
  return order.is_paid === true || normalizeStatusKey(order.status) === "paid";
}

function orderPaymentTerminated(order) {
  const s = normalizeStatusKey(order.status);
  return (
    s === "cancelled" ||
    s === "canceled" ||
    s === "failed" ||
    s === "payment_failed"
  );
}

/** แถวจาก Express: buyer_email / buyer_name, status ฯลฯ */
function normalizeSellerOrderRow(row) {
  if (!row || typeof row !== "object") return row;
  const o = { ...row };
  o.date_created = o.date_created ?? o.created_at;
  o.total = o.total ?? o.total_price;
  o.seller_total = o.seller_total ?? o.total_price ?? o.total;
  if (o.is_paid == null) o.is_paid = normalizeStatusKey(o.status) === "paid";
  if (!o.billing && (o.buyer_email || o.buyer_name)) {
    const name = String(o.buyer_name || "").trim();
    const parts = name ? name.split(/\s+/) : [];
    o.billing = {
      email: o.buyer_email || "",
      first_name: parts[0] || name || "",
      last_name: parts.length > 1 ? parts.slice(1).join(" ") : "",
      phone: o.buyer_phone || "",
    };
  }
  o.tracking_number = o.tracking_number ?? o.trackingNumber ?? "";
  o.shipping_receipt_number =
    o.shipping_receipt_number ?? o.shippingReceiptNumber ?? "";
  o.courier_name = o.courier_name ?? o.courierName ?? "";
  o.fulfillment_updated_at =
    o.fulfillment_updated_at ?? o.fulfillmentUpdatedAt ?? null;
  return o;
}

const SHIPPING_STATUS_KEYS = [
  "pending",
  "preparing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function normalizeShippingStatus(s) {
  const v = String(s || "pending").toLowerCase().replace(/-/g, "_");
  return SHIPPING_STATUS_KEYS.includes(v) ? v : "pending";
}

function getLineItemImage(item) {
  if (!item) return null;
  const u = item.image_url != null ? String(item.image_url).trim() : "";
  if (u) return u;
  if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    const img = item.images[0];
    if (img?.src) return img.src;
    if (img?.sourceUrl) return img.sourceUrl;
  }
  if (typeof item.image === "string" && item.image.trim() !== "") return item.image;
  if (item.image && typeof item.image === "object" && item.image.sourceUrl) {
    return item.image.sourceUrl;
  }
  if (item.image?.src) return item.image.src;
  return null;
}

function draftFor(order) {
  const id = order.id;
  if (!fulfillmentDrafts.value[id]) {
    fulfillmentDrafts.value[id] = reactive({
      tracking_number: String(order.tracking_number || ""),
    });
  }
  return fulfillmentDrafts.value[id];
}

function shipmentStepsForOrder(order) {
  return buildShipmentTimelineSteps({
    status: order.status,
    date_created: order.date_created || order.created_at,
    created_at: order.created_at || order.date_created,
    shipping_status: normalizeShippingStatus(order.shipping_status),
    fulfillment_updated_at: order.fulfillment_updated_at,
  });
}

async function saveFulfillment(order) {
  const jwt = user.value?.token;
  if (!jwt) {
    push.error(t("auth.login_required"));
    return;
  }
  const d = draftFor(order);
  savingFulfillmentId.value = order.id;
  try {
    const raw = await $fetch(cmsPath(`seller-orders/${order.id}/fulfillment`), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: {
        tracking_number: d.tracking_number || "",
      },
    });
    const inner = unwrapApi(raw);
    const updated = inner?.order;
    if (updated) {
      const ix = orders.value.findIndex((o) => o.id === order.id);
      if (ix >= 0) {
        const prev = orders.value[ix];
        orders.value[ix] = normalizeSellerOrderRow({
          ...prev,
          ...updated,
          line_items: prev.line_items,
        });
      }
      delete fulfillmentDrafts.value[order.id];
      push.success(t("seller_orders.fulfillment_saved"));
    }
  } catch (e) {
    const msg =
      e?.data?.error?.message ||
      e?.data?.message ||
      e?.message ||
      t("seller_orders.fulfillment_save_error");
    push.error(msg);
  } finally {
    savingFulfillmentId.value = null;
  }
}

// Get payment progress steps (Yardsale: pending | paid | canceled | payment_failed + Woo-style)
const getPaymentSteps = (order) => {
  const paid = orderPaid(order);
  const term = orderPaymentTerminated(order);
  const step2 = term ? "cancelled" : paid ? "completed" : "current";
  const step34 = term ? "cancelled" : paid ? "completed" : "pending";

  return [
    {
      id: 1,
      label: t("payment_steps.ordered"),
      status: "completed",
      icon: "i-heroicons-shopping-bag",
    },
    {
      id: 2,
      label: t("payment_steps.pending"),
      status: step2,
      icon: "i-heroicons-clock",
    },
    {
      id: 3,
      label: t("payment_steps.processing"),
      status: step34,
      icon: "i-heroicons-magnifying-glass",
    },
    {
      id: 4,
      label: t("payment_steps.completed"),
      status: step34,
      icon: "i-heroicons-check-circle",
    },
  ];
};

const getCurrentStep = (order) => {
  if (orderPaymentTerminated(order)) return 0;
  if (orderPaid(order)) return 4;
  if (normalizeStatusKey(order.status) === "pending") return 2;
  return 1;
};

// Fetch seller orders
const fetchOrders = async () => {
  if (!user.value) {
    error.value = t('auth.login_required');
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;
    fulfillmentDrafts.value = {};

    // Get JWT token from user object (stored during login)
    const jwtToken = user.value?.token;
    
    if (!jwtToken) {
      error.value = t('auth.login_required') + ' (JWT token missing. Please login again.)';
      isLoading.value = false;
      return;
    }

    const raw = await $fetch(cmsPath("seller-orders"), {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      query: paginationQuery(listPage.value, listSearch.value, ORDER_PAGE_SIZE),
    });
    const body = unwrapApi(raw);
    const list = Array.isArray(body?.orders)
      ? body.orders
      : Array.isArray(body?.data?.orders)
        ? body.data.orders
        : [];

    if (body && body.success === false) {
      error.value = body?.error?.message || body?.message || t("seller_orders.error_loading");
      orders.value = [];
      orderPagination.value = {
        page: 1,
        page_size: ORDER_PAGE_SIZE,
        total: 0,
        total_pages: 0,
      };
    } else {
      orders.value = list.map(normalizeSellerOrderRow);
    }

    const pg = pickPagination(body);
    if (pg) {
      orderPagination.value = pg;
    } else {
      orderPagination.value = {
        page: listPage.value,
        page_size: ORDER_PAGE_SIZE,
        total: orders.value.length,
        total_pages: orders.value.length ? 1 : 0,
      };
    }
  } catch (err) {
    console.error("[seller-orders] Error fetching orders:", err);
    error.value = err?.message || t('seller_orders.error_loading');
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

onMounted(async () => {
  isClient.value = true;
  checkAuth();
  await nextTick();

  if (!isAuthenticated.value || !user.value) {
    router.push("/login");
    return;
  }

  await fetchOrders();
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>
      <template v-if="isLoading">
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <UIcon
              name="i-svg-spinners-90-ring-with-bg"
              class="w-8 h-8 mb-4 text-neutral-400 dark:text-neutral-600 mx-auto"
            />
            <p class="text-neutral-500 dark:text-neutral-400">
              {{ $t('seller_orders.loading_orders') }}
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
              {{ $t('seller_orders.retry') }}
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="isAuthenticated && user">
        <div class="max-w-6xl mx-auto p-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-black dark:text-white">
              {{ $t('seller_orders.title') }}
            </h1>
            <NuxtLink
              to="/"
              class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
            >
              {{ $t('seller_orders.back_to_home') }}
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
                    ? $t('seller_orders.no_orders_search')
                    : $t('seller_orders.no_orders')
                }}
              </p>
              <p class="text-neutral-500 dark:text-neutral-400 mb-4">
                {{
                  listSearch.trim()
                    ? $t('seller_orders.no_orders_search_hint')
                    : $t('seller_orders.no_customers')
                }}
              </p>
            </div>
          </template>

          <template v-else>
            <div class="space-y-4">
              <div
                v-for="order in orders"
                :key="order.id"
                class="relative bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
              >
                <!-- Button - Absolute position for md and up -->
                <NuxtLink
                  :to="`/order/${order.id}`"
                  class="absolute top-4 right-4 px-4 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg text-center hidden md:block"
                >
                  {{ $t('order.view_details') }}
                </NuxtLink>

                <div
                  class="flex flex-col md:flex-row md:items-start md:justify-between gap-4"
                >
                  <div class="flex-1">
                    <div class="flex items-center gap-4 mb-3 flex-wrap">
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

                    <div
                      v-if="order.line_items?.length"
                      class="mb-4 p-4 rounded-xl bg-violet-50/90 dark:bg-violet-950/25 border-2 border-violet-200 dark:border-violet-900"
                    >
                      <p
                        class="text-sm font-semibold text-violet-900 dark:text-violet-200 mb-2"
                      >
                        {{ $t("seller_orders.products_in_order") }}
                      </p>
                      <ul class="space-y-2 text-sm text-neutral-800 dark:text-neutral-200">
                        <li
                          v-for="li in order.line_items"
                          :key="`${order.id}-${li.product_id}`"
                          class="flex items-center gap-3"
                        >
                          <StorefrontImg
                            v-if="getLineItemImage(li)"
                            :src="getLineItemImage(li)"
                            :alt="li.name || $t('common.product')"
                            class="w-12 h-12 shrink-0 object-cover rounded-lg border-2 border-violet-200 dark:border-violet-800"
                            loading="lazy"
                          />
                          <div
                            v-else
                            class="w-12 h-12 shrink-0 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center border-2 border-violet-200 dark:border-violet-800"
                          >
                            <UIcon
                              name="i-heroicons-photo"
                              class="w-6 h-6 text-violet-400 dark:text-violet-500"
                            />
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                              {{ li.name || $t("common.product") }}
                            </p>
                            <p class="text-neutral-500 dark:text-neutral-400 text-xs tabular-nums">
                              × {{ li.quantity }}
                            </p>
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- Customer Information Card -->
                    <div class="mb-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
                      <p class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">
                        {{ $t('seller_orders.customer_info') }}
                      </p>
                      <div class="space-y-2 text-sm">
                        <p class="text-neutral-700 dark:text-neutral-300">
                          <span class="font-semibold">{{ $t('seller_orders.customer') }}:</span>
                          <span class="ml-2">
                            {{ order.billing?.first_name || '' }}
                            {{ order.billing?.last_name || '' }}
                            <span v-if="!order.billing?.first_name && !order.billing?.last_name" class="text-neutral-500">
                              {{ $t('my_products.na') }}
                            </span>
                          </span>
                        </p>
                        <p class="text-neutral-700 dark:text-neutral-300" v-if="order.billing?.email">
                          <span class="font-semibold">{{ $t('seller_orders.email') }}:</span>
                          <span class="ml-2">{{ order.billing.email }}</span>
                        </p>
                        <p class="text-neutral-700 dark:text-neutral-300" v-if="order.billing?.phone">
                          <span class="font-semibold">{{ $t('seller_orders.phone') }}:</span>
                          <span class="ml-2">{{ order.billing.phone }}</span>
                        </p>
                        <template v-if="order.billing?.address_1 || order.billing?.city">
                          <p class="text-neutral-700 dark:text-neutral-300 mt-2">
                            <span class="font-semibold">{{ $t('seller_orders.shipping_address') }}:</span>
                          </p>
                          <p class="text-neutral-600 dark:text-neutral-400 text-sm pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                            {{ order.billing.address_1 }}
                            <span v-if="order.billing.address_2">, {{ order.billing.address_2 }}</span>
                          </p>
                          <p class="text-neutral-600 dark:text-neutral-400 text-sm pl-2">
                            {{ order.billing.city
                            }}<span v-if="order.billing.state">, {{ order.billing.state }}</span
                            ><span v-if="order.billing.postcode"> {{ order.billing.postcode }}</span>
                          </p>
                        </template>
                        <p class="text-neutral-700 dark:text-neutral-300">
                          <span class="font-semibold">{{ $t('seller_orders.order_date') }}:</span>
                          <span class="ml-2">{{ formatDate(order.date_created) }}</span>
                        </p>
                        <p class="text-neutral-700 dark:text-neutral-300">
                          <span class="font-semibold">{{ $t('order.payment_method') }}:</span>
                          <span class="ml-2">
                            {{
                              order.payment_method_title ||
                              order.payment_method ||
                              $t('my_products.na')
                            }}
                          </span>
                        </p>
                        <p class="text-neutral-700 dark:text-neutral-300" v-if="order.transaction_id">
                          <span class="font-semibold">{{ $t('order.transaction_id') }}:</span>
                          <span class="ml-2 font-mono text-xs">{{ order.transaction_id }}</span>
                        </p>
                        <p class="text-neutral-700 dark:text-neutral-300">
                          <span class="font-semibold">{{ $t('order.payment_status_customer') }}:</span>
                          <span class="ml-2 inline-flex items-center gap-2 flex-wrap">
                            <span
                              :class="[
                                'px-2 py-1 rounded text-xs font-semibold',
                                paymentColorClass(order),
                              ]"
                            >
                              {{ paymentLabel(order) }}
                            </span>
                            <span
                              v-if="order.slip_image_url"
                              class="text-xs text-neutral-500 dark:text-neutral-400"
                            >
                              {{ $t('seller_orders.slip_uploaded') }}
                            </span>
                          </span>
                        </p>
                        <!-- Date Paid -->
                        <p class="text-neutral-700 dark:text-neutral-300" v-if="order.date_paid">
                          <span class="font-semibold">{{ $t('order.date_paid') }}:</span>
                          <span class="ml-2">{{ formatDate(order.date_paid) }}</span>
                        </p>
                      </div>
                    </div>

                    <!-- Payment Status - Progress Bar Steps -->
                    <div
                      class="mb-4 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 border-2 border-neutral-200 dark:border-neutral-800"
                    >
                      <div class="mb-4">
                        <p
                          class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3"
                        >
                          {{ $t('order.payment_status_customer') }}
                        </p>
                        <div class="relative">
                          <!-- Progress Bar Line -->
                          <div
                            class="absolute top-5 left-0 right-0 h-0.5 bg-neutral-200 dark:bg-neutral-700"
                          >
                            <div
                              :class="[
                                'h-full transition-all duration-500',
                                orderPaymentTerminated(order)
                                  ? 'bg-red-500 w-0'
                                  : normalizeStatusKey(order.status) === 'completed'
                                  ? 'bg-green-500 w-full'
                                  : orderPaid(order)
                                  ? 'bg-blue-500'
                                  : 'bg-yellow-500',
                              ]"
                              :style="{
                                width: `${(getCurrentStep(order) / 4) * 100}%`,
                              }"
                            ></div>
                          </div>

                          <!-- Steps -->
                          <div class="relative flex justify-between">
                            <div
                              v-for="step in getPaymentSteps(order)"
                              :key="step.id"
                              class="flex flex-col items-center"
                              :class="
                                step.id === 1
                                  ? 'items-start'
                                  : step.id === 4
                                  ? 'items-end'
                                  : ''
                              "
                            >
                              <!-- Step Circle -->
                              <div
                                :class="[
                                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                                  step.status === 'completed'
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : step.status === 'current'
                                    ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                                    : step.status === 'cancelled'
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500',
                                ]"
                              >
                                <UIcon :name="step.icon" class="w-5 h-5" />
                              </div>

                              <!-- Step Label -->
                              <div
                                class="mt-2 text-center"
                                :class="
                                  step.id === 1
                                    ? 'text-left'
                                    : step.id === 4
                                    ? 'text-right'
                                    : ''
                                "
                              >
                                <p
                                  :class="[
                                    'text-xs font-semibold',
                                    step.status === 'completed'
                                      ? 'text-green-600 dark:text-green-400'
                                      : step.status === 'current'
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : step.status === 'cancelled'
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-neutral-500 dark:text-neutral-400',
                                  ]"
                                >
                                  {{ step.label }}
                                </p>
                                <p
                                  v-if="step.id === 2 && order.date_paid"
                                  class="text-xs text-neutral-400 dark:text-neutral-600 mt-1"
                                >
                                  {{ formatDate(order.date_paid) }}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
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
                            {{
                              getPaymentSteps(order).find(
                                (s) => s.status === "current"
                              )?.label ||
                              getPaymentSteps(order).find(
                                (s) => s.status === "completed" && s.id === 4
                              )?.label ||
                              $t('payment_steps.pending')
                            }}
                          </p>
                        </div>
                        <div class="text-right">
                          <p
                            class="text-xs text-neutral-500 dark:text-neutral-600 mb-1"
                          >
                            {{ $t('seller_orders.amount_to_pay') }}
                          </p>
                          <p
                            class="text-xl font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-500"
                          >
                            ฿{{
                              parseFloat(order.seller_total || 0).toFixed(2)
                            }}
                          </p>
                        </div>
                      </div>
                    </div>

                    <!-- จัดส่ง: ไทม์ไลน์ + อัปเดต (หลังชำระแล้ว) -->
                    <div
                      v-if="orderPaid(order)"
                      class="mb-4 p-4 rounded-xl bg-teal-50/80 dark:bg-teal-950/25 border-2 border-teal-200 dark:border-teal-900"
                    >
                      <p class="text-sm font-semibold text-teal-900 dark:text-teal-100 mb-3">
                        {{ $t('seller_orders.fulfillment_section') }}
                      </p>
                      <ShipmentTimeline :steps="shipmentStepsForOrder(order)" />
                      <div class="mt-4 grid gap-3 sm:grid-cols-2">
                        <div class="sm:col-span-2">
                          <label
                            class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                            :for="`seller-tracking-${order.id}`"
                          >
                            {{ $t('order.tracking_number_label') }}
                          </label>
                          <input
                            :id="`seller-tracking-${order.id}`"
                            :name="`tracking_number_${order.id}`"
                            v-model="draftFor(order).tracking_number"
                            type="text"
                            autocomplete="off"
                            class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-black dark:text-white"
                            :placeholder="$t('seller_orders.tracking_placeholder')"
                          />
                        </div>
                        <div class="sm:col-span-2 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-alizarin-crimson-600 text-white hover:bg-alizarin-crimson-700 disabled:opacity-50"
                            :disabled="savingFulfillmentId === order.id"
                            @click="saveFulfillment(order)"
                          >
                            <UIcon
                              v-if="savingFulfillmentId === order.id"
                              name="i-svg-spinners-90-ring-with-bg"
                              class="w-4 h-4"
                            />
                            {{ $t('seller_orders.save_fulfillment') }}
                          </button>
                          <p
                            v-if="order.fulfillment_updated_at"
                            class="text-xs text-neutral-500 dark:text-neutral-400"
                          >
                            {{ $t('seller_orders.fulfillment_updated_at') }}
                            {{ formatDate(order.fulfillment_updated_at) }}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p
                      v-else
                      class="mb-4 text-sm text-neutral-500 dark:text-neutral-400"
                    >
                      {{ $t('seller_orders.fulfillment_after_payment') }}
                    </p>

                    <!-- Seller's Products in Order -->
                    <div
                      v-if="(order.seller_line_items && order.seller_line_items.length > 0) || (order.line_items && order.line_items.length > 0)"
                      class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <p
                        class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3"
                      >
                        {{ $t('seller_orders.your_products_in_order') }}:
                      </p>
                      <div class="space-y-3">
                        <div
                          v-for="item in (order.seller_line_items || order.line_items)"
                          :key="`${order.id}-${item.product_id}`"
                          class="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800"
                        >
                          <!-- Product Image -->
                          <div class="flex-shrink-0">
                            <StorefrontImg
                              v-if="getLineItemImage(item)"
                              :src="getLineItemImage(item)"
                              :alt="item.name || $t('common.product')"
                              class="w-16 h-16 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700"
                            />
                            <div
                              v-else
                              class="w-16 h-16 rounded-lg bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center"
                            >
                              <UIcon name="i-iconamoon-category-fill" size="24" class="text-neutral-400" />
                            </div>
                          </div>
                          <!-- Product Info -->
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-black dark:text-white truncate">
                              {{ item.name || $t('common.product') }}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              {{ $t('order.quantity') }}: {{ item.quantity }}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">
                              {{ $t('order.unit_price') }}: ฿{{ parseFloat(item.price != null ? item.price : (item.total || 0) / (item.quantity || 1)).toFixed(2) }}
                            </p>
                          </div>
                          <!-- Product Total -->
                          <div class="flex-shrink-0 text-right">
                            <p class="text-sm font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-500">
                              ฿{{ parseFloat(item.total || 0).toFixed(2) }}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              {{ $t('order.total') }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Button - Show on mobile only -->
                  <div class="flex flex-col items-end gap-3 md:hidden">
                    <NuxtLink
                      :to="`/order/${order.id}`"
                      class="px-4 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg text-center"
                    >
                      {{ $t('order.view_details') }}
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </template>
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
  </div>
</template>
