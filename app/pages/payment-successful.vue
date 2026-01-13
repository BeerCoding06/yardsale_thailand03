<!--app/pages/payment-successful.vue-->
<script setup>
definePageMeta({
  ssr: false, // Disable SSR to prevent hydration mismatches
});

const { order } = useCheckout();
const router = useRouter();

// Redirect to home if no order data
onMounted(() => {
  if (!order.value || !order.value.id) {
    console.warn('[payment-successful] No order data, redirecting to home');
    router.push('/');
  }
});

// Format order date
const formattedDate = computed(() => {
  if (!order.value || !order.value.date_created) return '';
  
  const date = new Date(order.value.date_created);
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
});

// Format total price
const formattedTotal = computed(() => {
  if (!order.value || !order.value.total) return '0.00';
  return parseFloat(order.value.total).toFixed(2);
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>
      <div v-if="order && order.id" class="max-w-2xl mx-auto p-6">
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
            สั่งซื้อสำเร็จ!
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 text-center">
            ขอบคุณสำหรับการสั่งซื้อ เราจะติดต่อกลับไปในเร็วๆ นี้
          </p>
        </div>

        <!-- Order Details Card -->
        <div
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            รายละเอียดออเดอร์
          </h2>

          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >หมายเลขออเดอร์:</span
              >
              <span class="font-semibold text-lg text-black dark:text-white"
                >#{{ order.number || order.id }}</span
              >
            </div>

            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >วันที่สั่งซื้อ:</span
              >
              <span class="font-semibold text-black dark:text-white">{{
                formattedDate
              }}</span>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >สถานะ:</span
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
                {{
                  order.status === 'pending'
                    ? 'รอการตรวจสอบ'
                    : order.status === 'processing'
                    ? 'กำลังดำเนินการ'
                    : order.status === 'completed'
                    ? 'เสร็จสมบูรณ์'
                    : order.status
                }}
              </span>
            </div>

            <div class="flex justify-between items-center">
              <span class="text-neutral-600 dark:text-neutral-400"
                >วิธีการชำระเงิน:</span
              >
              <span class="font-semibold text-black dark:text-white">{{
                order.payment_method_title || 'ชำระเงินปลายทาง'
              }}</span>
            </div>

            <div
              class="border-t-2 border-neutral-200 dark:border-neutral-800 pt-4 mt-4"
            >
              <div class="flex justify-between items-center">
                <span class="text-lg font-semibold text-black dark:text-white"
                  >ยอดรวม:</span
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
            ที่อยู่จัดส่ง
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
              โทร: {{ order.billing.phone }}
            </p>
            <p class="text-neutral-600 dark:text-neutral-400">
              อีเมล: {{ order.billing.email }}
            </p>
          </div>
        </div>

        <!-- Order Items -->
        <div
          v-if="order.line_items && order.line_items.length > 0"
          class="bg-white/80 dark:bg-black/20 rounded-2xl p-6 shadow-lg border-2 border-neutral-200 dark:border-neutral-800 mb-6"
        >
          <h2 class="text-xl font-semibold mb-4 text-black dark:text-white">
            สินค้าที่สั่งซื้อ
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
                  จำนวน: {{ item.quantity }} ชิ้น
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
            กลับไปหน้าหลัก
          </NuxtLink>
          <NuxtLink
            to="/my-orders"
            class="flex-1 px-6 py-3 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-center"
          >
            รายการสั่งซื้อของฉัน
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
            ไม่พบข้อมูลออเดอร์
          </h2>
          <p class="text-neutral-500 dark:text-neutral-400 mb-6">
            ไม่พบข้อมูลออเดอร์ กรุณาลองใหม่อีกครั้ง
          </p>
          <NuxtLink
            to="/"
            class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
          >
            กลับไปหน้าหลัก
          </NuxtLink>
        </div>
      </div>

      <template #fallback>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">
              กำลังโหลด...
            </p>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

