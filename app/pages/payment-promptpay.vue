<!-- หน้าแสดง QR PromptPay — ใช้ qr_uri จาก Omise หรือสร้างจาก code หรือปุ่มเปิด authorize_uri -->
<script setup>
definePageMeta({ auth: false });
const route = useRoute();
const orderId = route.query.order_id;
const code = route.query.code;
const qrUri = route.query.qr_uri;
const authorizeUri = route.query.authorize_uri;
const amount = route.query.amount;
const qrImageUrl = computed(() => {
  if (qrUri) return qrUri;
  if (code) return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(code)}`;
  return null;
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
    <div class="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6">
      <div class="text-center mb-6">
        <UIcon
          name="i-heroicons-qr-code"
          class="w-14 h-14 mx-auto mb-4 text-alizarin-crimson-500 dark:text-alizarin-crimson-400"
        />
        <h1 class="text-xl font-bold text-black dark:text-white">
          {{ $t('checkout.pay.promptpay_title') || 'ชำระด้วย PromptPay' }}
        </h1>
        <p v-if="amount" class="text-lg font-bold text-black dark:text-white mt-1">
          ยอด {{ amount }} ฿
        </p>
        <p v-if="orderId" class="text-sm text-neutral-500 dark:text-neutral-400">
          ออเดอร์ #{{ orderId }}
        </p>
      </div>

      <p class="text-sm text-neutral-600 dark:text-neutral-400 text-center mb-4">
        {{ $t('checkout.pay.scan_qr') || 'สแกน QR Code ด้วยแอปธนาคารหรือพร้อมเพย์' }}
      </p>
      <div v-if="qrImageUrl" class="flex justify-center">
        <div class="inline-block p-4 bg-white dark:bg-neutral-900 rounded-xl border-2 border-neutral-200 dark:border-neutral-600">
          <img :src="qrImageUrl" alt="PromptPay QR" class="w-[220px] h-[220px]" />
        </div>
      </div>
      <div v-else-if="authorizeUri" class="flex justify-center py-6">
        <a
          :href="authorizeUri"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 hover:bg-alizarin-crimson-700"
        >
          {{ $t('checkout.pay.open_omise_page') || 'เปิดหน้าชำระ Omise (สแกน QR / ทดสอบ)' }}
        </a>
        <p class="mt-3 text-xs text-neutral-500 dark:text-neutral-400 text-center w-full">
          {{ $t('checkout.pay.open_omise_hint') || 'หรือรอ 10–20 วินาที ในโหมดทดสอบ Omise จะ simulate การชำระอัตโนมัติ' }}
        </p>
      </div>
      <div v-else class="flex justify-center py-8">
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ $t('checkout.pay.qr_loading') || 'กำลังโหลด QR Code...' }}</p>
      </div>

      <p class="mt-4 text-xs text-neutral-500 dark:text-neutral-400 text-center">
        {{ $t('checkout.pay.promptpay_hint') || 'โอนตามยอดด้านบน แล้วกดปุ่ม "ชำระแล้ว" ด้านล่าง' }}
      </p>

      <!-- Test Mode: Omise จะ simulate payment หลังเปิดหน้านี้ ~10-20 วินาที -->
      <div class="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <p class="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">
          {{ $t('checkout.pay.test_mode_title') || '⚠️ วิธีจ่ายใน Test Mode' }}
        </p>
        <p class="text-xs text-amber-700 dark:text-amber-300">
          {{ $t('checkout.pay.test_mode_promptpay') || 'QR Code ในโหมดทดสอบจ่ายเงินจริงไม่ได้ — Omise จะ simulate การชำระอัตโนมัติ: เปิดหน้านี้แล้วรอประมาณ 10–20 วินาที Omise จะส่ง webhook (charge.complete) แล้วออเดอร์จะเปลี่ยนเป็น Processing' }}
        </p>
      </div>

      <NuxtLink
        :to="`/payment-successful?order_id=${orderId}`"
        class="mt-6 w-full block text-center py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 hover:bg-alizarin-crimson-700"
      >
        {{ $t('checkout.pay.after_paid') || 'ชำระแล้ว' }}
      </NuxtLink>
    </div>
  </div>
</template>
