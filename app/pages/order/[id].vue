<!--app/pages/order/[id].vue-->
<script setup>
definePageMeta({
  middleware: "auth",
  ssr: false,
});

const route = useRoute();
const router = useRouter();
const { user, isAuthenticated, checkAuth } = useAuth();

const orderId = computed(() => route.params.id);
const isClient = ref(false);
const isLoading = ref(true);
const order = ref(null);
const error = ref(null);

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

// Format order status
const getStatusText = (status) => {
  const statusMap = {
    pending: t('order.pending'),
    processing: t('order.processing_status'),
    on_hold: t('order.on_hold'),
    completed: t('order.completed'),
    cancelled: t('order.cancelled'),
    refunded: t('order.refunded'),
    failed: t('order.failed'),
  };
  return statusMap[status] || status;
};

const getStatusColor = (status) => {
  const colorMap = {
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    processing: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    on_hold: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
    completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    cancelled: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    refunded: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
    failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  };
  return colorMap[status] || "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200";
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

    const customerId = user.value.id || user.value.ID;
    const queryParams = new URLSearchParams({
      order_id: String(orderId.value),
      ...(customerId ? { customer_id: String(customerId) } : {}),
    });

    const orderData = await $fetch(`/api/get-order?${queryParams.toString()}`);

    if (orderData.success && orderData.order) {
      order.value = orderData.order;
    } else {
      error.value = t('order.order_not_found');
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
              {{ $t('order.order_details') }} #{{ order.number || order.id }}
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

              <div class="flex justify-between items-center">
                <span class="text-neutral-600 dark:text-neutral-400"
                  >{{ $t('order.order_status') }}:</span
                >
                <span
                  :class="[
                    'px-3 py-1 rounded-full text-sm font-semibold',
                    getStatusColor(order.status),
                  ]"
                >
                  {{ getStatusText(order.status) }}
                </span>
              </div>

              <div class="flex justify-between items-center">
                <span class="text-neutral-600 dark:text-neutral-400"
                  >วิธีการชำระเงิน:</span
                >
                <span class="font-semibold text-black dark:text-white">{{
                  order.payment_method_title || order.payment_method || "N/A"
                }}</span>
              </div>

              <div
                class="flex justify-between items-center border-t border-neutral-300 dark:border-neutral-700 pt-3 mt-3"
              >
                <span
                  class="dark:text-neutral-300 text-neutral-700 text-xl font-bold"
                  >ยอดรวม:</span
                >
                <span
                  class="font-bold text-2xl text-alizarin-crimson-600 dark:text-alizarin-crimson-500"
                  >฿{{ parseFloat(order.total || 0).toFixed(2) }}</span
                >
              </div>
            </div>
          </div>

          <!-- Billing Address Card -->
          <div
            v-if="order.billing"
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
          >
            <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
              ที่อยู่จัดส่ง
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
                โทร: {{ order.billing.phone }}
              </p>
              <p class="text-neutral-600 dark:text-neutral-400">
                อีเมล: {{ order.billing.email }}
              </p>
            </div>
          </div>

          <!-- Order Items Card -->
          <div
            v-if="order.line_items && order.line_items.length > 0"
            class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
          >
            <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
              รายการสินค้า
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
                    จำนวน: {{ item.quantity }} ชิ้น
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
                    ฿{{ parseFloat(item.price || 0).toFixed(2) }} x
                    {{ item.quantity }}
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
            <p class="text-neutral-500 dark:text-neutral-400">กำลังโหลด...</p>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

