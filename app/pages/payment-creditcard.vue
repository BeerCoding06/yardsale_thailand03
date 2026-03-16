<!-- หน้าเลือกชำระด้วยบัตรเครดิต (Omise) –  placeholder สำหรับใส่ฟอร์มบัตรภายหลัง -->
<script setup>
definePageMeta({ auth: false });
const route = useRoute();
const orderId = route.query.order_id;
const amount = route.query.amount;
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
    <div class="max-w-sm w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6 text-center">
      <UIcon
        name="i-heroicons-credit-card"
        class="w-14 h-14 mx-auto mb-4 text-alizarin-crimson-500 dark:text-alizarin-crimson-400"
      />
      <h1 class="text-xl font-bold text-black dark:text-white mb-2">
        {{ $t('checkout.pay.credit_card_title') || 'ชำระด้วยบัตรเครดิต' }}
      </h1>
      <p v-if="amount" class="text-lg font-bold text-black dark:text-white">
        ยอด {{ amount }} ฿
      </p>
      <p v-if="orderId" class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
        ออเดอร์ #{{ orderId }}
      </p>
      <p class="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {{ $t('checkout.pay.credit_card_coming_soon') || 'ช่องทางบัตรเครดิต (Omise) จะเปิดให้ใช้งานเร็วๆ นี้' }}
      </p>
      <NuxtLink
        :to="`/payment-successful?order_id=${orderId}`"
        class="mt-6 inline-block px-6 py-3 rounded-xl font-semibold bg-alizarin-crimson-600 text-white hover:bg-alizarin-crimson-700"
      >
        {{ $t('checkout.pay.view_order') || 'ดูออเดอร์' }}
      </NuxtLink>
    </div>
  </div>
</template>
