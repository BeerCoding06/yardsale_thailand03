<!--app/pages/my-orders.vue-->
<script setup>
definePageMeta({
  middleware: "auth",
  ssr: false, // Disable SSR to prevent hydration mismatches
});

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();

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

// Computed for cancel button text
const getCancelButtonText = (orderId) => {
  return cancellingOrderId.value === orderId
    ? t("cancelling")
    : t("cancel_order");
};

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

// Format shipping status
const getShippingStatusText = (status) => {
  const statusMap = {
    pending: t('shipping.pending'),
    preparing: t('shipping.preparing'),
    shipped: t('shipping.shipped'),
    on_hold: t('shipping.on_hold'),
    delivered: t('shipping.delivered'),
  };
  return statusMap[status] || status;
};

const getShippingStatusColor = (status) => {
  const colorMap = {
    pending:
      "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    preparing:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    shipped:
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200",
    on_hold:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
    delivered:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
  };
  return (
    colorMap[status] ||
    "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
  );
};

const getShippingStatusIcon = (status) => {
  const iconMap = {
    pending: "i-iconamoon-clock-fill",
    preparing: "i-iconamoon-package-fill",
    shipped: "i-iconamoon-truck-fill",
    on_hold: "i-iconamoon-pause-circle-fill",
    delivered: "i-iconamoon-check-circle-1-fill",
  };
  return iconMap[status] || "i-iconamoon-info-circle-fill";
};

// Get shipping progress steps
const getShippingSteps = (order) => {
  const steps = [
    {
      id: 1,
      label: t('shipping.ordered'),
      status: "completed",
      icon: "i-heroicons-shopping-bag",
    },
    {
      id: 2,
      label: t('shipping.prepare'),
      status:
        order.shipping_status === "preparing" ||
        order.shipping_status === "shipped" ||
        order.shipping_status === "delivered"
          ? "completed"
          : order.shipping_status === "pending"
          ? "current"
          : "pending",
      icon: "i-iconamoon-box-duotone",
    },
    {
      id: 3,
      label: t('shipping.shipped'),
      status:
        order.shipping_status === "shipped" ||
        order.shipping_status === "delivered"
          ? order.shipping_status === "shipped"
            ? "current"
            : "completed"
          : "pending",
      icon: "i-heroicons-truck",
    },
    {
      id: 4,
      label: t('shipping.delivered'),
      status: order.shipping_status === "delivered" ? "completed" : "pending",
      icon: "i-heroicons-check-circle",
    },
  ];

  // Handle on_hold status
  if (order.shipping_status === "on_hold") {
    steps.forEach((step) => {
      if (step.id > 1) step.status = "cancelled";
    });
  }

  return steps;
};

// Get current step number
const getCurrentStep = (order) => {
  if (order.shipping_status === "on_hold") return 0;
  if (order.shipping_status === "delivered") return 4;
  if (order.shipping_status === "shipped") return 3;
  if (order.shipping_status === "preparing") return 2;
  return 1;
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

    // Use customer_id or email to fetch orders
    const customerId = user.value.id || user.value.ID;
    const customerEmail = user.value.email || user.value.user_email;

    const queryParams = new URLSearchParams();
    if (customerId) {
      queryParams.append("customer_id", String(customerId));
    }
    if (customerEmail) {
      queryParams.append("customer_email", customerEmail);
    }

    const ordersData = await $fetch(`/api/my-orders?${queryParams.toString()}`);

    orders.value = Array.isArray(ordersData.orders) ? ordersData.orders : [];
    console.log("[my-orders] Loaded orders:", orders.value.length);
  } catch (err) {
    console.error("[my-orders] Error fetching orders:", err);
    error.value = err?.message || t('order.error_loading');
    orders.value = [];
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

    const customerId = user.value.id || user.value.ID;

    const response = await $fetch("/api/cancel-order", {
      method: "POST",
      body: {
        order_id: orderId,
        customer_id: customerId,
      },
    });

    if (response.success) {
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

// Check if order can be cancelled
const canCancelOrder = (order) => {
  const cancellableStatuses = ['pending', 'processing', 'on-hold'];
  return cancellableStatuses.includes(order.status);
};
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

          <template v-if="orders.length === 0">
            <div
              class="bg-white/80 dark:bg-black/20 rounded-2xl p-12 text-center border-2 border-neutral-200 dark:border-neutral-800"
            >
              <UIcon
                name="i-heroicons-shopping-bag"
                class="w-16 h-16 mx-auto mb-4 text-neutral-400 dark:text-neutral-600"
              />
              <p class="text-xl font-semibold text-black dark:text-white mb-2">
                {{ $t('order.no_orders') }}
              </p>
              <p class="text-neutral-500 dark:text-neutral-400 mb-6">
                {{ $t('order.start_shopping') }}
              </p>
              <NuxtLink
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
                    <div class="flex items-center gap-4 mb-2">
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
                        >฿{{ parseFloat(order.total || 0).toFixed(2) }}</span
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
                      <div class="relative">
                        <!-- Progress Bar Line -->
                        <div
                          class="absolute top-5 left-0 right-0 h-0.5 bg-neutral-200 dark:bg-neutral-700"
                        >
                          <div
                            :class="[
                              'h-full transition-all duration-500',
                              order.shipping_status === 'on_hold'
                                ? 'bg-red-500 w-0'
                                : order.shipping_status === 'delivered'
                                ? 'bg-green-500 w-full'
                                : order.shipping_status === 'shipped'
                                ? 'bg-purple-500'
                                : order.shipping_status === 'preparing'
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
                            v-for="step in getShippingSteps(order)"
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
                            getShippingSteps(order).find(
                              (s) => s.status === "current"
                            )?.label ||
                            getShippingSteps(order).find(
                              (s) => s.status === "completed" && s.id === 4
                            )?.label ||
                            $t('shipping.pending')
                          }}
                        </p>
                      </div>
                      <div v-if="order.tracking_number" class="text-right">
                        <p
                          class="text-xs text-neutral-500 dark:text-neutral-600 mb-1"
                        >
                          {{ $t('order.tracking_number_label') }}
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
                      {{ order.shipping_methods[0].method_title || "N/A" }}
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
                      <img
                        v-if="item.image"
                        :src="item.image"
                        :alt="item.name"
                        class="w-12 h-12 object-cover rounded-lg border-2 border-neutral-200 dark:border-neutral-700"
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
