<!--app/pages/seller-orders.vue-->
<script setup>
definePageMeta({
  middleware: "auth",
  ssr: false,
});

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();

const isClient = ref(false);
const isLoading = ref(true);
const orders = ref([]);
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
    pending:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    processing:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    on_hold:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
    completed:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    cancelled: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    refunded:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
    failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  };
  return (
    colorMap[status] ||
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
  );
};

// Get payment status text
const getPaymentStatusText = (paymentStatus) => {
  const statusMap = {
    paid: t('order.paid') || 'ชำระเงินแล้ว',
    pending: t('order.pending') || 'รอการชำระเงิน',
    processing: t('order.processing_status') || 'กำลังดำเนินการ',
    on_hold: t('order.on_hold') || 'รอการตรวจสอบ',
    failed: t('order.failed') || 'ชำระเงินล้มเหลว',
    refunded: t('order.refunded') || 'คืนเงินแล้ว',
    cancelled: t('order.cancelled') || 'ยกเลิก',
  };
  return statusMap[paymentStatus] || paymentStatus;
};

// Get payment status color
const getPaymentStatusColor = (paymentStatus) => {
  const colorMap = {
    paid: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    processing: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    on_hold: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
    failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    refunded: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
    cancelled: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
  };
  return (
    colorMap[paymentStatus] ||
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
  );
};

// Get payment progress steps
const getPaymentSteps = (order) => {
  const steps = [
    {
      id: 1,
      label: t('payment_steps.ordered'),
      status: "completed",
      icon: "i-heroicons-shopping-bag",
    },
    {
      id: 2,
      label: t('payment_steps.pending'),
      status: order.is_paid
        ? "completed"
        : order.status === "pending"
        ? "current"
        : "pending",
      icon: "i-heroicons-clock",
    },
    {
      id: 3,
      label: t('payment_steps.processing'),
      status: order.is_paid
        ? order.status === "processing" || order.status === "completed"
          ? "completed"
          : "current"
        : "pending",
      icon: "i-heroicons-magnifying-glass",
    },
    {
      id: 4,
      label: t('payment_steps.completed'),
      status:
        order.status === "completed"
          ? "completed"
          : order.is_paid && order.status === "processing"
          ? "current"
          : "pending",
      icon: "i-heroicons-check-circle",
    },
  ];

  // Handle cancelled/failed status
  if (order.status === "cancelled" || order.status === "failed") {
    steps.forEach((step) => {
      if (step.id > 1) step.status = "cancelled";
    });
  }

  return steps;
};

// Get current step number
const getCurrentStep = (order) => {
  if (order.status === "cancelled" || order.status === "failed") return 0;
  if (order.status === "completed") return 4;
  if (order.is_paid && order.status === "processing") return 3;
  if (order.is_paid) return 2;
  if (order.status === "pending") return 1;
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

    // Get JWT token from user object (stored during login)
    const jwtToken = user.value?.token;
    
    if (!jwtToken) {
      error.value = t('auth.login_required') + ' (JWT token missing. Please login again.)';
      isLoading.value = false;
      return;
    }

    // Get WordPress base URL from runtime config
    const config = useRuntimeConfig();
    const wpBaseUrl = config.public.wpBaseUrl || 'http://157.85.98.150:8080';
    
    // Call WordPress custom endpoint directly with JWT token
    const ordersData = await $fetch(`${wpBaseUrl}/wp-json/yardsale/v1/seller-orders`, {
      headers: {
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    
    if (ordersData && ordersData.success !== false) {
      orders.value = Array.isArray(ordersData.orders) ? ordersData.orders : [];
    } else {
      error.value = ordersData?.error || ordersData?.message || t('seller_orders.error_loading');
      orders.value = [];
    }
  } catch (err) {
    console.error("[seller-orders] Error fetching orders:", err);
    error.value = err?.message || t('seller_orders.error_loading');
    orders.value = [];
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

          <template v-if="orders.length === 0">
            <div
              class="bg-white/80 dark:bg-black/20 rounded-2xl p-12 text-center border-2 border-neutral-200 dark:border-neutral-800"
            >
              <UIcon
                name="i-heroicons-shopping-bag"
                class="w-16 h-16 mx-auto mb-4 text-neutral-400 dark:text-neutral-600"
              />
              <p class="text-xl font-semibold text-black dark:text-white mb-2">
                {{ $t('seller_orders.no_orders') }}
              </p>
              <p class="text-neutral-500 dark:text-neutral-400 mb-4">
                {{ $t('seller_orders.no_customers') }}
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
                      <span
                        :class="[
                          'px-3 py-1 rounded-full text-xs font-semibold',
                          getStatusColor(order.status),
                        ]"
                      >
                        {{ getStatusText(order.status) }}
                      </span>
                      <!-- Payment Status Badge -->
                      <span
                        v-if="order.payment_status"
                        :class="[
                          'px-3 py-1 rounded-full text-xs font-semibold',
                          getPaymentStatusColor(order.payment_status),
                        ]"
                      >
                        {{ getPaymentStatusText(order.payment_status) }}
                      </span>
                      <!-- Paid Badge -->
                      <span
                        v-if="order.is_paid"
                        class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                      >
                        {{ $t('order.paid') || 'ชำระเงินแล้ว' }}
                      </span>
                    </div>

                    <!-- Customer Information Card -->
                    <div class="mb-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
                      <p class="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">
                        {{ $t('seller_orders.customer_info') || 'ข้อมูลผู้ซื้อ' }}
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
                          <span class="font-semibold">{{ $t('seller_orders.email') || 'อีเมล' }}:</span>
                          <span class="ml-2">{{ order.billing.email }}</span>
                        </p>
                        <p class="text-neutral-700 dark:text-neutral-300" v-if="order.billing?.phone">
                          <span class="font-semibold">{{ $t('seller_orders.phone') }}:</span>
                          <span class="ml-2">{{ order.billing.phone }}</span>
                        </p>
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
                          <span class="font-semibold">{{ $t('order.transaction_id') || 'Transaction ID' }}:</span>
                          <span class="ml-2 font-mono text-xs">{{ order.transaction_id }}</span>
                        </p>
                        <!-- Payment Status -->
                        <p class="text-neutral-700 dark:text-neutral-300">
                          <span class="font-semibold">{{ $t('order.payment_status') || 'สถานะการชำระเงิน' }}:</span>
                          <span class="ml-2">
                            <span
                              :class="[
                                'px-2 py-1 rounded text-xs font-semibold',
                                getPaymentStatusColor(order.payment_status || 'pending'),
                              ]"
                            >
                              {{ getPaymentStatusText(order.payment_status || 'pending') }}
                            </span>
                            <span
                              v-if="order.is_paid"
                              class="ml-2 text-xs text-green-600 dark:text-green-400"
                            >
                              ✓ {{ $t('order.paid') || 'ชำระเงินแล้ว' }}
                            </span>
                          </span>
                        </p>
                        <!-- Date Paid -->
                        <p class="text-neutral-700 dark:text-neutral-300" v-if="order.date_paid">
                          <span class="font-semibold">{{ $t('order.date_paid') || 'วันที่ชำระเงิน' }}:</span>
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
                                order.status === 'cancelled' ||
                                order.status === 'failed'
                                  ? 'bg-red-500 w-0'
                                  : order.status === 'completed'
                                  ? 'bg-green-500 w-full'
                                  : order.is_paid
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

                    <!-- Seller's Products in Order -->
                    <div
                      v-if="(order.seller_line_items && order.seller_line_items.length > 0) || (order.line_items && order.line_items.length > 0)"
                      class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800"
                    >
                      <p
                        class="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3"
                      >
                        {{ $t('seller_orders.your_products_in_order') || 'สินค้าของคุณที่ถูกซื้อ' }}:
                      </p>
                      <div class="space-y-3">
                        <div
                          v-for="item in (order.seller_line_items || order.line_items)"
                          :key="item.id"
                          class="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800"
                        >
                          <!-- Product Image -->
                          <div class="flex-shrink-0">
                            <NuxtImg
                              v-if="item.image?.src || item.image"
                              :src="item.image?.src || item.image"
                              :alt="item.name"
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
                              {{ item.name }}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              {{ $t('order.quantity') || 'จำนวน' }}: {{ item.quantity }}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400">
                              {{ $t('order.unit_price') || 'ราคาต่อชิ้น' }}: ฿{{ parseFloat((item.total || 0) / (item.quantity || 1)).toFixed(2) }}
                            </p>
                          </div>
                          <!-- Product Total -->
                          <div class="flex-shrink-0 text-right">
                            <p class="text-sm font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-500">
                              ฿{{ parseFloat(item.total || 0).toFixed(2) }}
                            </p>
                            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              {{ $t('order.total') || 'รวม' }}
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
