<!-- หน้าแสดง QR PromptPay (จาก Omise scannable_code) -->
<script setup>
definePageMeta({ auth: false });
const route = useRoute();
const orderId = route.query.order_id;
const code = route.query.code;
const amount = route.query.amount;
const qrImageUrl = computed(() => {
  if (!code) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(code)}`;
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
    <div class="max-w-sm w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 text-center">
      <h1 class="text-xl font-bold text-black dark:text-white mb-2">
        {{ $t('checkout.pay.promptpay_title') || 'ชำระด้วย PromptPay' }}
      </h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        {{ $t('checkout.pay.scan_qr') || 'สแกน QR Code ด้วยแอปธนาคาร' }}
      </p>
      <div v-if="qrImageUrl" class="inline-block p-4 bg-white rounded-xl border-2 border-neutral-200 dark:border-neutral-600 mb-4">
        <img :src="qrImageUrl" alt="PromptPay QR" class="w-[220px] h-[220px]" />
      </div>
      <p v-if="amount" class="text-lg font-bold text-black dark:text-white">
        ยอด {{ amount }} ฿
      </p>
      <p v-if="orderId" class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
        ออเดอร์ #{{ orderId }}
      </p>
      <NuxtLink
        :to="`/payment-successful?order_id=${orderId}`"
        class="mt-6 inline-block px-6 py-3 rounded-xl font-semibold bg-alizarin-crimson-600 text-white hover:bg-alizarin-crimson-700"
      >
        {{ $t('checkout.pay.after_paid') || 'ชำระแล้ว' }}
      </NuxtLink>
    </div>
  </div>
</template>
