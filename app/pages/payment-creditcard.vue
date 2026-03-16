<!-- หน้าชำระด้วยบัตรเครดิต (Omise) – ฟอร์มกรอกบัตร + Test card -->
<script setup>
definePageMeta({ auth: false });
const route = useRoute();
const orderId = route.query.order_id;
const amount = route.query.amount;

const cardNumber = ref('');
const expiry = ref('');
const cvv = ref('');
const isSubmitting = ref(false);
const cardError = ref('');

function formatCardNumber(v) {
  const digits = String(v).replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(v) {
  const digits = String(v).replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 2) {
    return digits.slice(0, 2) + '/' + digits.slice(2);
  }
  return digits;
}

function formatCvv(v) {
  return String(v).replace(/\D/g, '').slice(0, 4);
}

watch(cardNumber, (val) => {
  cardNumber.value = formatCardNumber(val);
});

watch(expiry, (val) => {
  expiry.value = formatExpiry(val);
});

watch(cvv, (val) => {
  cvv.value = formatCvv(val);
});

async function handleSubmit() {
  cardError.value = '';
  const number = cardNumber.value.replace(/\s/g, '');
  const exp = expiry.value.replace(/\D/g, '');
  const c = cvv.value.trim();
  if (number.length < 16) {
    cardError.value = 'กรุณากรอกหมายเลขบัตรครบ 16 หลัก';
    return;
  }
  if (exp.length !== 4) {
    cardError.value = 'กรุณากรอกวันหมดอายุ (MM/YY)';
    return;
  }
  if (c.length < 3) {
    cardError.value = 'กรุณากรอก CVV';
    return;
  }
  isSubmitting.value = true;
  try {
    // TODO: สร้าง Omise token แล้วเรียก API charge บัตร
    // await $fetch('/api/omise-create-charge-card', { method: 'POST', body: { order_id: orderId, amount_thb: amount, token: omiseToken } });
    cardError.value = 'ระบบชำระบัตร (Omise) กำลังเชื่อมต่อ — ใช้ Test card ด้านล่างทดสอบได้';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
    <div class="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6">
      <div class="text-center mb-6">
        <UIcon
          name="i-heroicons-credit-card"
          class="w-14 h-14 mx-auto mb-4 text-alizarin-crimson-500 dark:text-alizarin-crimson-400"
        />
        <h1 class="text-xl font-bold text-black dark:text-white">
          {{ $t('checkout.pay.credit_card_title') || 'ชำระด้วยบัตรเครดิต' }}
        </h1>
        <p v-if="amount" class="text-lg font-bold text-black dark:text-white mt-1">
          ยอด {{ amount }} ฿
        </p>
        <p v-if="orderId" class="text-sm text-neutral-500 dark:text-neutral-400">
          ออเดอร์ #{{ orderId }}
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-black dark:text-white mb-1">หมายเลขบัตร</label>
          <input
            v-model="cardNumber"
            type="text"
            inputmode="numeric"
            autocomplete="cc-number"
            maxlength="19"
            placeholder="4242 4242 4242 4242"
            class="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-black dark:text-white placeholder:text-neutral-400 focus:border-alizarin-crimson-500 focus:outline-none"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-black dark:text-white mb-1">หมดอายุ (MM/YY)</label>
            <input
              v-model="expiry"
              type="text"
              inputmode="numeric"
              autocomplete="cc-exp"
              maxlength="5"
              placeholder="12/30"
              class="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-black dark:text-white placeholder:text-neutral-400 focus:border-alizarin-crimson-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-black dark:text-white mb-1">CVV</label>
            <input
              v-model="cvv"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              maxlength="4"
              placeholder="123"
              class="w-full px-4 py-3 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-black dark:text-white placeholder:text-neutral-400 focus:border-alizarin-crimson-500 focus:outline-none"
            />
          </div>
        </div>

        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ $t('checkout.pay.test_card_hint') || 'บัตรทดสอบ (Omise): 4242 4242 4242 4242 | หมดอายุ 12/30 | CVV 123' }}
        </p>

        <div v-if="cardError" class="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
          {{ cardError }}
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 hover:bg-alizarin-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!isSubmitting">{{ $t('checkout.pay.pay_now') || 'ชำระเงิน' }}</span>
          <span v-else>{{ $t('checkout.pay.processing') || 'กำลังดำเนินการ...' }}</span>
        </button>
      </form>

      <NuxtLink
        :to="`/payment-successful?order_id=${orderId}`"
        class="mt-4 block text-center text-sm text-neutral-500 dark:text-neutral-400 hover:text-alizarin-crimson-500"
      >
        {{ $t('checkout.pay.view_order') || 'ข้าม — ดูออเดอร์' }}
      </NuxtLink>
    </div>
  </div>
</template>
