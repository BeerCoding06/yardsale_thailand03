<!-- ชำระด้วย PayPal หลังเลือกจาก modal checkout -->
<script setup lang="ts">
import { getOfetchErrorMessage } from '~/utils/ofetch-error-message';

definePageMeta({ auth: false });
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

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
const config = useRuntimeConfig();
const checkoutCurrency = computed(
  () => (config.public.paypalCheckoutCurrency as string) || 'THB'
);

function onPayPalSuccess(payload: unknown) {
  const p = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
  if (p?.woocommerce_updated === false) {
    if (p?.warning_code === 'MISSING_ORDER_PAID_SECRET') {
      paypalSdkError.value = t('checkout.pay.paypal_missing_order_paid_secret');
    } else if (p?.warning_code === 'MISSING_WOOCOMMERCE_UPDATE_CONFIG') {
      paypalSdkError.value = t('checkout.pay.paypal_missing_wc_update_config');
    } else if (p?.warning) {
      paypalSdkError.value = String(p.warning);
    } else {
      paypalSdkError.value = t('checkout.pay.paypal_missing_order_paid_secret');
    }
    return;
  }
  router.push(`/payment-successful?order_id=${orderId.value}`);
}

/** PayPal SDK / $fetch — รวมถึง scf_* / COMPLIANCE_VIOLATION */
function serializePayPalErr(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  return getOfetchErrorMessage(err);
}

const paypalSdkError = ref<string | null>(null);

function onPayPalError(err: unknown) {
  const raw = serializePayPalErr(err);
  console.error('[PayPal]', err);
  if (/COMPLIANCE_VIOLATION|scf_/i.test(raw)) {
    paypalSdkError.value = t('checkout.pay.paypal_compliance_hint');
  } else if (raw) {
    const base = t('checkout.pay.paypal_sdk_error');
    // แสดงข้อความจาก API (เช่น woocommerce_order_id / capture status) — ไม่ตัดที่ 120 ตัวอักษร
    paypalSdkError.value = raw.length > 280 ? `${base}. ${raw.slice(0, 280)}…` : `${base}: ${raw}`;
  } else {
    paypalSdkError.value = t('checkout.pay.paypal_sdk_error');
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-900">
    <div class="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl p-6">
      <h1 class="text-xl font-bold text-black dark:text-white text-center mb-1">
        {{ $t('checkout.pay.paypal_title') }}
      </h1>
      <p v-if="orderId" class="text-center text-sm text-neutral-500 dark:text-neutral-400">
        {{ $t('checkout.pay.order_number_display', { n: orderId }) }}
      </p>
      <p
        class="text-center text-lg font-bold text-black dark:text-white mt-2"
        :class="checkoutCurrency === 'USD' ? 'mb-1' : 'mb-6'"
      >
        <template v-if="checkoutCurrency === 'USD'">
          {{ amount }} THB
          <span class="block text-sm font-normal text-neutral-600 dark:text-neutral-400 mt-1">
            {{ $t('checkout.pay.store_order_total_hint') }}
          </span>
        </template>
        <template v-else> {{ amount }} {{ checkoutCurrency }} </template>
      </p>
      <p
        v-if="checkoutCurrency === 'USD'"
        class="text-center text-xs text-amber-700 dark:text-amber-400 mb-6 max-w-xs mx-auto"
      >
        {{ $t('checkout.pay.paypal_sandbox_usd_note') }}
      </p>

      <div v-if="!orderId || amount === '0.00'" class="text-center text-red-600 text-sm">
        {{ $t('checkout.pay.paypal_invalid') }}
      </div>
      <ClientOnly v-else>
        <p
          v-if="paypalSdkError"
          class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4"
        >
          {{ paypalSdkError }}
        </p>
        <div :class="{ 'opacity-60 pointer-events-none': paying }">
          <PaymentPayPalSmartButton
            :woocommerce-order-id="orderId"
            :amount="amount"
            @success="onPayPalSuccess"
            @cancel="() => {}"
            @error="onPayPalError"
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
        {{ $t('checkout.pay.view_order') }}
      </NuxtLink>
    </div>
  </div>
</template>
