<!-- ชำระด้วย PayPal หลังเลือกจาก modal checkout -->
<script setup lang="ts">
definePageMeta({ auth: false });
const route = useRoute();
const router = useRouter();

const orderIdRaw = route.query.order_id;
const amountRaw = route.query.amount;
const orderId = computed(() => {
  const v = Array.isArray(orderIdRaw) ? orderIdRaw[0] : orderIdRaw;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
});
const amount = computed(() => {
  const v = Array.isArray(amountRaw) ? amountRaw[0] : amountRaw;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : '0.00';
});

const paying = ref(false);

function onSuccess() {
  router.push(`/payment-successful?order_id=${orderId.value}`);
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
    <div class="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6">
      <h1 class="text-xl font-bold text-black dark:text-white text-center mb-1">
        {{ $t('checkout.pay.paypal_title') || 'ชำระด้วย PayPal' }}
      </h1>
      <p v-if="orderId" class="text-center text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('checkout.pay.order_ref') || 'ออเดอร์' }} #{{ orderId }}
      </p>
      <p class="text-center text-lg font-bold text-black dark:text-white mt-2 mb-6">
        {{ amount }} THB
      </p>

      <div v-if="!orderId || amount === '0.00'" class="text-center text-red-600 text-sm">
        {{ $t('checkout.pay.paypal_invalid') || 'ลิงก์ไม่ถูกต้อง กรุณาสั่งซื้อใหม่จากตะกร้า' }}
      </div>
      <ClientOnly v-else>
        <div :class="{ 'opacity-60 pointer-events-none': paying }">
          <PaymentPayPalSmartButton
            :woocommerce-order-id="orderId"
            :amount="amount"
            currency="THB"
            @success="onSuccess"
            @cancel="() => {}"
            @error="(e) => console.error('[PayPal]', e)"
            @loading="(v) => (paying = v)"
          />
        </div>
        <template #fallback>
          <p class="text-sm text-neutral-500 text-center">{{ $t('general.loading') }}</p>
        </template>
      </ClientOnly>

      <NuxtLink
        v-if="orderId"
        :to="`/payment-successful?order_id=${orderId}`"
        class="mt-6 block text-center text-sm text-neutral-500 dark:text-neutral-400 hover:text-alizarin-crimson-500"
      >
        {{ $t('checkout.pay.view_order') || 'ข้าม — ดูออเดอร์' }}
      </NuxtLink>
    </div>
  </div>
</template>
