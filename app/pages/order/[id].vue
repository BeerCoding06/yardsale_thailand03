<!--app/pages/order/[id].vue-->
<script setup>
definePageMeta({
  middleware: "auth",
  ssr: false,
});

import { messageFromYardsaleBody, yardsaleBodyIsFailure } from "~/utils/cmsApiEndpoint";
import {
  buildShipmentTimelineSteps,
  getShipmentActiveStepIndex,
  orderShipmentFingerprint,
} from "~/utils/shipmentTimeline";

const route = useRoute();
const router = useRouter();
const { user, isAuthenticated, checkAuth } = useAuth();
const { t, locale } = useI18n();
const { hasRemoteApi, fetchYardsale } = useStorefrontCatalog();
const { paymentLabel, paymentColorClass } = useCustomerPaymentStatus();
const { notify } = useNotification();

const orderId = computed(() => route.params.id);
const isClient = ref(false);
const isLoading = ref(true);
const order = ref(null);
const error = ref(null);
const showTrackingModal = ref(false);

const timelineSteps = computed(() =>
  order.value ? buildShipmentTimelineSteps(order.value) : []
);

const showShipmentTimeline = computed(() => {
  if (!order.value) return false;
  return getShipmentActiveStepIndex(order.value) >= 0;
});

/** แสดงปุ่มติดตามเมื่อมีเลขพัสดุ หรือขั้นตอนถึงขนส่งแล้ว */
const canOpenTracking = computed(() => {
  if (!order.value) return false;
  if (getShipmentActiveStepIndex(order.value) < 0) return false;
  const o = order.value;
  if (String(o.tracking_number || o.trackingNumber || "").trim()) return true;
  return getShipmentActiveStepIndex(o) >= 2;
});

function notifyShipmentFingerprintChange() {
  const o = order.value;
  if (!o) return;
  const id = String(o.id ?? orderId.value);
  const fp = orderShipmentFingerprint(o);
  const key = `yardsale-order-fp-${id}`;
  try {
    const prev = sessionStorage.getItem(key);
    if (prev && prev !== fp) {
      const ship = String(o.shipping_status || "").toLowerCase();
      if (ship === "shipped" && !prev.includes("shipped")) {
        notify(t("order.notification_shipped"), "success");
      } else {
        notify(t("order.notification_status_updated"), "info");
      }
    }
    sessionStorage.setItem(key, fp);
  } catch {
    /* ignore */
  }
}

// Format order date (follows current UI locale)
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale.value, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

// Fetch order details
const fetchOrder = async () => {
  if (!user.value) {
    error.value = t('auth.login_required');
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    error.value = null;

    if (hasRemoteApi) {
      const id = encodeURIComponent(String(orderId.value));
      const inner = await fetchYardsale(`get-order/${id}`, {
        headers: {
          ...(user.value?.token
            ? { Authorization: `Bearer ${user.value.token}` }
            : {}),
        },
      });
      if (yardsaleBodyIsFailure(inner)) {
        error.value = messageFromYardsaleBody(inner, t("order.error_loading"));
        order.value = null;
      } else {
        const o = inner?.order;
        if (o) {
          const prev =
            order.value && typeof order.value === "object" ? { ...order.value } : {};
          order.value = {
            ...prev,
            ...o,
            status: o.status ?? o.order_status ?? prev.status,
            is_paid:
              o.is_paid !== undefined && o.is_paid !== null ? o.is_paid : prev.is_paid,
            total: String(o.total_price ?? o.total ?? prev.total ?? 0),
            date_created: o.created_at ?? o.date_created ?? prev.date_created,
          };
          notifyShipmentFingerprintChange();
        } else {
          error.value = t("order.order_not_found");
        }
      }
    } else {
      const customerId = user.value.id || user.value.ID;
      const queryParams = new URLSearchParams({
        order_id: String(orderId.value),
        ...(customerId ? { customer_id: String(customerId) } : {}),
      });

      const orderData = await $fetch(`/api/get-order?${queryParams.toString()}`);

      if (orderData.success && orderData.order) {
        order.value = orderData.order;
        notifyShipmentFingerprintChange();
      } else {
        error.value = t("order.order_not_found");
      }
    }
  } catch (err) {
    console.error("[order-detail] Error fetching order:", err);
    error.value = err?.data?.message || err?.message || t('order.error_loading');
    order.value = null;
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

  await fetchOrder();
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
              {{ $t('order.loading_order_details') }}
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
            <div class="flex gap-4 justify-center">
              <button
                @click="fetchOrder"
                class="px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
              >
                {{ $t('order.retry') }}
              </button>
              <NuxtLink
                to="/my-orders"
                class="px-6 py-3 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
              >
                {{ $t('order.back_to_orders') }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="order">
        <div class="max-w-4xl mx-auto p-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-black dark:text-white">
              {{ $t('order.order_details') }}
            </h1>
            <NuxtLink
              to="/my-orders"
              class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
            >
              {{ $t('order.back_to_orders') }}
            </NuxtLink>
          </div>

          <!-- Order Summary Card -->
          <div
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
          >
            <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
              {{ $t('order.order_summary') }}
            </h2>

            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-neutral-600 dark:text-neutral-400"
                  >{{ $t('order.order_number') }}:</span
                >
                <span class="font-semibold text-lg text-black dark:text-white"
                  >#{{ order.number || order.id }}</span
                >
              </div>

              <div class="flex justify-between items-center">
                <span class="text-neutral-600 dark:text-neutral-400"
                  >{{ $t('order.order_date') }}:</span
                >
                <span class="font-semibold text-black dark:text-white">{{
                  formatDate(order.date_created)
                }}</span>
              </div>

              <div class="flex justify-between items-center gap-3">
                <span class="text-neutral-600 dark:text-neutral-400 shrink-0"
                  >{{ $t('order.payment_status_customer') }}</span
                >
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-sm font-semibold shrink-0',
                    paymentColorClass(order),
                  ]"
                >
                  {{ paymentLabel(order) }}
                </span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-neutral-600 dark:text-neutral-400"
                  >{{ $t('payment_success.payment_method_label') }}</span
                >
                <span class="font-semibold text-black dark:text-white">{{
                  order.payment_method_title || order.payment_method || $t('common.not_available')
                }}</span>
              </div>

              <div
                class="flex justify-between items-center border-t border-neutral-300 dark:border-neutral-700 pt-3 mt-3"
              >
                <span
                  class="dark:text-neutral-300 text-neutral-700 text-xl font-bold"
                  >{{ $t('payment_success.total_label') }}</span
                >
                <span
                  class="font-bold text-2xl text-alizarin-crimson-600 dark:text-alizarin-crimson-500"
                  >฿{{ parseFloat(order.total || 0).toFixed(2) }}</span
                >
              </div>
            </div>
          </div>

          <!-- Shipment timeline + track -->
          <div
            v-if="showShipmentTimeline"
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
              <h2 class="text-xl font-semibold text-black dark:text-white">
                {{ $t('order.shipment_section_title') }}
              </h2>
              <button
                v-if="canOpenTracking"
                type="button"
                class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                @click="showTrackingModal = true"
              >
                <UIcon name="i-heroicons-map" class="h-5 w-5" />
                {{ $t('order.track_order') }}
              </button>
            </div>
            <ShipmentTimeline :steps="timelineSteps" />
          </div>

          <OrderTrackingModal v-model="showTrackingModal" :order="order" />

          <!-- Billing Address Card -->
          <div
            v-if="order.billing"
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
          >
            <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
              {{ $t('payment_success.shipping_address') }}
            </h2>

            <div class="space-y-2 text-sm">
              <p class="text-black dark:text-white">
                <span class="font-semibold">{{ order.billing.first_name }}</span>
                <span class="font-semibold">{{ order.billing.last_name }}</span>
              </p>
              <p class="text-neutral-600 dark:text-neutral-400">
                {{ order.billing.address_1 }}
                <span v-if="order.billing.address_2"
                  >, {{ order.billing.address_2 }}</span
                >
              </p>
              <p class="text-neutral-600 dark:text-neutral-400">
                {{ order.billing.city }}
                <span v-if="order.billing.state">, {{ order.billing.state }}</span>
                <span v-if="order.billing.postcode"
                  >, {{ order.billing.postcode }}</span
                >
              </p>
              <p class="text-neutral-600 dark:text-neutral-400">
                {{ $t('payment_success.phone_label') }} {{ order.billing.phone }}
              </p>
              <p class="text-neutral-600 dark:text-neutral-400">
                {{ $t('payment_success.email_label') }} {{ order.billing.email }}
              </p>
            </div>
          </div>

          <!-- Order Items Card -->
          <div
            v-if="order.line_items && order.line_items.length > 0"
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
          >
            <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
              {{ $t('order.line_items_title') }}
            </h2>

            <div class="space-y-4">
              <div
                v-for="item in order.line_items"
                :key="item.id"
                class="flex justify-between items-start py-4 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0"
              >
                <div class="flex-1">
                  <p class="font-semibold text-black dark:text-white mb-1">
                    {{ item.name }}
                  </p>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400">
                    {{ $t('payment_success.qty_pcs', { n: item.quantity }) }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="font-semibold text-black dark:text-white">
                    ฿{{ parseFloat(item.total || 0).toFixed(2) }}
                  </p>
                  <p
                    v-if="item.quantity > 1"
                    class="text-xs text-neutral-500 dark:text-neutral-400"
                  >
                    {{
                      $t('order.price_times_qty', {
                        price: parseFloat(item.price || 0).toFixed(2),
                        qty: item.quantity,
                      })
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #fallback>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">{{ $t('order.loading_order_details') }}</p>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

