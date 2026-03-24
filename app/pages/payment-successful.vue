<!--app/pages/payment-successful.vue-->
<script setup>
definePageMeta({
  ssr: false, // Disable SSR to prevent hydration mismatches
});

const route = useRoute();
const { order } = useCheckout();
const router = useRouter();
const { t, locale } = useI18n();
const loadingOrder = ref(false);

// เมื่อเข้ามาจากหน้าชำระ จะมี order_id ใน query แต่ไม่มี order ใน state – ให้โหลดออเดอร์
onMounted(async () => {
  const orderId = route.query.order_id;
  if (orderId && (!order.value || !order.value.id)) {
    loadingOrder.value = true;
    try {
      const data = await $fetch('/api/get-order', { query: { order_id: orderId } });
      if (data?.order) {
        order.value = data.order;
      }
    } catch (e) {
      console.warn('[payment-successful] Failed to fetch order:', e);
    } finally {
      loadingOrder.value = false;
    }
  }
  if (!order.value?.id && !orderId) {
    console.warn('[payment-successful] No order data, redirecting to home');
    router.push('/');
  }
});

// Format order date (follows current UI locale)
const formattedDate = computed(() => {
  if (!order.value || !order.value.date_created) return '';

  const date = new Date(order.value.date_created);
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
});

const orderStatusLabel = computed(() => {
  const s = order.value?.status;
  if (!s) return '';
  const map = {
    pending: 'order.pending',
    processing: 'order.processing_status',
    completed: 'order.completed',
    cancelled: 'order.cancelled',
    refunded: 'order.refunded',
    failed: 'order.failed',
    'on-hold': 'order.on_hold',
  };
  const key = map[s];
  return key ? t(key) : s;
});

const paymentMethodDisplay = computed(() =>
  order.value?.payment_method_title || t('order.payment_method_cod')
);

// Format total price
const formattedTotal = computed(() => {
  if (!order.value || !order.value.total) return '0.00';
  return parseFloat(order.value.total).toFixed(2);
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>
      <div v-if="loadingOrder" class="max-w-2xl mx-auto p-6 flex justify-center items-center min-h-[40vh]">
        <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-10 h-10 text-neutral-400" />
      </div>
      <div v-else-if="order && order.id" class="max-w-2xl mx-auto p-6">
        <!-- Success Header -->
        <div class="flex flex-col items-center justify-center mb-8 mt-8 gap-2">
          <div
            class="bg-green-500/20 dark:bg-green-700/20 flex rounded-full p-4 mb-2"
          >
            <UIcon
              name="i-iconamoon-check-circle-1-fill"
              size="64"
              class="text-green-600 dark:text-green-400 shadow-md"
            />
          </div>
          <h1 class="text-3xl font-bold text-black dark:text-white">
            {{ $t('payment_success.title') }}
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 text-center">
            {{ $t('payment_success.subtitle') }}
          </p>
        </div>

        <!-- Order Details Card -->
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            {{ $t('payment_success.order_details') }}
          </h2>

          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >{{ $t('payment_success.order_number_label') }}</span
              >
              <span class="font-semibold text-lg text-black dark:text-white"
                >#{{ order.number || order.id }}</span
              >
            </div>

            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >{{ $t('payment_success.order_date_label') }}</span
              >
              <span class="font-semibold text-black dark:text-white">{{
                formattedDate
              }}</span>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >{{ $t('payment_success.status_label') }}</span
              >
              <span
                :class="[
                  'font-semibold px-3 py-1 rounded-full text-sm',
                  order.status === 'pending'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                    : order.status === 'processing'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                    : order.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200',
                ]"
              >
                {{ orderStatusLabel }}
              </span>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >{{ $t('payment_success.payment_method_label') }}</span
              >
              <span class="font-semibold text-black dark:text-white">{{
                paymentMethodDisplay
              }}</span>
            </div>

            <div
              class="border-t-2 border-neutral-200 dark:border-neutral-800 pt-4 mt-4"
            >
              <div class="flex justify-between items-center">
                <span class="text-lg font-semibold text-black dark:text-white"
                  >{{ $t('payment_success.total_label') }}</span
                >
                <span class="text-2xl font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-500"
                  >฿{{ formattedTotal }}</span
                >
              </div>
            </div>
          </div>
        </div>

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
            </p>
            <p
              v-if="order.billing.address_2"
              class="text-neutral-600 dark:text-neutral-400"
            >
              {{ order.billing.address_2 }}
            </p>
            <p class="text-neutral-600 dark:text-neutral-400">
              {{ order.billing.city }}
              <span v-if="order.billing.state">, {{ order.billing.state }}</span>
              <span v-if="order.billing.postcode">
                {{ order.billing.postcode }}</span
              >
            </p>
            <p class="text-neutral-600 dark:text-neutral-400">
              {{ order.billing.country }}
            </p>
            <p class="text-neutral-600 dark:text-neutral-400">
              {{ $t('payment_success.phone_label') }} {{ order.billing.phone }}
            </p>
            <p class="text-neutral-600 dark:text-neutral-400">
              {{ $t('payment_success.email_label') }} {{ order.billing.email }}
            </p>
          </div>
        </div>

        <!-- Order Items -->
        <div
          v-if="order.line_items && order.line_items.length > 0"
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            {{ $t('payment_success.items_ordered') }}
          </h2>

          <div class="space-y-4">
            <div
              v-for="(item, index) in order.line_items"
              :key="index"
              class="flex gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800 last:border-0"
            >
              <div
                v-if="item.image"
                class="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0"
              >
                <img
                  :src="item.image.src || item.image"
                  :alt="item.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-black dark:text-white mb-1">
                  {{ item.name }}
                </h3>
                <p class="text-sm text-neutral-600 dark:text-neutral-400">
                  {{ $t('payment_success.qty_pcs', { n: item.quantity }) }}
                </p>
                <p class="text-sm font-semibold text-black dark:text-white mt-1">
                  ฿{{ parseFloat(item.price || 0).toFixed(2) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-4">
          <NuxtLink
            to="/"
            class="flex-1 px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg hover:shadow-xl text-center"
          >
            {{ $t('payment_success.back_home') }}
          </NuxtLink>
          <NuxtLink
            to="/my-orders"
            class="flex-1 px-6 py-3 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-center"
          >
            {{ $t('payment_success.my_orders') }}
          </NuxtLink>
        </div>
      </div>

      <!-- No Order Data -->
      <div v-else class="max-w-2xl mx-auto p-6">
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-12 text-center border-2 border-neutral-200 dark:border-neutral-800"
        >
          <UIcon
            name="i-heroicons-exclamation-triangle"
            class="w-16 h-16 mx-auto mb-4 text-yellow-500 dark:text-yellow-400"
          />
          <h2 class="text-xl font-semibold text-black dark:text-white mb-2">
            {{ $t('payment_success.no_order_title') }}
          </h2>
          <p class="text-neutral-500 dark:text-neutral-400 mb-6">
            {{ $t('payment_success.no_order_message') }}
          </p>
          <NuxtLink
            to="/"
            class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
          >
            {{ $t('payment_success.back_home') }}
          </NuxtLink>
        </div>
      </div>

      <template #fallback>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">
              {{ $t('payment_success.loading') }}
            </p>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

