<script setup>
import { push } from 'notivue';

definePageMeta({
  ssr: false,
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const localePath = useLocalePath();
const { submitBankSlip, order } = useCheckout();
const { isAuthenticated, checkAuth } = useAuth();
const config = useRuntimeConfig();

const orderId = computed(() => String(route.query.order_id || ''));
const amount = computed(() => String(route.query.amount || ''));

/** รูป Thai QR — override ได้ด้วย NUXT_PUBLIC_PROMPTPAY_QR_URL */
const qrSrc = computed(() => {
  const u = String(config.public.promptpayQrImageUrl || '').trim();
  return u || '/images/promptpay-qr.png';
});

/** เลขบัญชีร้าน: env ครอบ i18n (หลายบรรทัด) */
const bankTransferDisplay = computed(() => {
  const fromEnv = String(config.public.storeBankTransferInfo || '').trim();
  return fromEnv || t('checkout.payment_slip.bank_account_default');
});

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    push.success(t('checkout.payment_slip.copied'));
  } catch {
    push.error(t('checkout.payment_slip.copy_failed'));
  }
}

function copyPromptPay() {
  copyToClipboard(t('checkout.payment_slip.promptpay_number'));
}

function copyBankDetails() {
  copyToClipboard(bankTransferDisplay.value);
}

const slipFile = ref(null);
const slipUrl = ref('');
const slipData = ref('');
const error = ref(null);
const submitting = ref(false);

onMounted(() => {
  checkAuth();
  if (!isAuthenticated.value || !orderId.value) {
    router.replace(localePath('/'));
  }
});

function onFileChange(e) {
  const f = e.target?.files?.[0];
  slipFile.value = f || null;
  error.value = null;
}

function slipErrorMessage(err) {
  const code =
    err?.data?.error?.code ||
    err?.data?.code ||
    err?.response?._data?.error?.code;
  if (code) {
    const msg = t(`checkout.payment_slip.errors.${code}`);
    if (msg !== `checkout.payment_slip.errors.${code}`) return msg;
  }
  return (
    err?.data?.error?.message ||
    err?.message ||
    t('checkout.payment_slip.errors.generic')
  );
}

async function onSubmit() {
  error.value = null;
  const hasFile = !!slipFile.value;
  const hasUrl = !!String(slipUrl.value || '').trim();
  const hasData = !!String(slipData.value || '').trim();
  if (!hasFile && !hasUrl && !hasData) {
    error.value = t('checkout.payment_slip.errors.PAYMENT_PROOF_REQUIRED');
    return;
  }
  submitting.value = true;
  try {
    const res = await submitBankSlip({
      orderId: orderId.value,
      amount: amount.value,
      file: slipFile.value || undefined,
      slipUrl: slipUrl.value,
      slipData: slipData.value,
    });
    const paid = res?.paid === true;
    if (paid) {
      const o = res?.order;
      if (o?.id) {
        order.value = {
          ...o,
          number: o.number || String(o.id).replace(/-/g, '').slice(0, 12),
          total: String(o.total_price ?? o.total ?? 0),
          date_created: o.created_at ?? o.date_created,
        };
      }
      await router.push(
        localePath({
          path: '/payment-successful',
          query: { order_id: orderId.value },
        })
      );
      return;
    }
    error.value = t('checkout.payment_slip.errors.generic');
  } catch (err) {
    error.value = slipErrorMessage(err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black py-8 px-4">
    <div class="max-w-lg mx-auto">
      <h1 class="text-2xl font-bold text-black dark:text-white mb-2">
        {{ $t('checkout.payment_slip.title') }}
      </h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        {{
          $t('checkout.payment_slip.subtitle', {
            n: orderId || '—',
            amount: amount || '—',
          })
        }}
      </p>

      <div
        class="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100"
      >
        {{ $t('checkout.payment_slip.instructions') }}
      </div>

      <div
        class="mb-6 p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-black/40 border-2 border-neutral-200 dark:border-neutral-700"
      >
        <h2 class="text-sm font-semibold text-black dark:text-white mb-4">
          {{ $t('checkout.payment_slip.bank_section_title') }}
        </h2>

        <div class="flex flex-col items-center mb-4">
          <div
            class="rounded-2xl overflow-hidden bg-white p-3 shadow-lg border border-neutral-200 dark:border-neutral-600 max-w-[min(100%,280px)] w-full"
          >
            <img
              :src="qrSrc"
              :alt="$t('checkout.payment_slip.qr_alt')"
              class="w-full h-auto object-contain"
              width="280"
              height="280"
              loading="eager"
              decoding="async"
            />
          </div>
          <p
            class="mt-3 text-sm font-medium text-teal-700 dark:text-teal-400 text-center px-2"
          >
            {{ $t('checkout.payment_slip.qr_caption') }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2 justify-center mb-4">
          <button
            type="button"
            class="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition"
            @click="copyPromptPay"
          >
            {{ $t('checkout.payment_slip.copy_promptpay') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 transition"
            @click="copyBankDetails"
          >
            {{ $t('checkout.payment_slip.copy_bank_details') }}
          </button>
        </div>

        <pre
          class="whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-200 font-sans bg-neutral-50 dark:bg-black/30 rounded-xl p-3 border border-neutral-200/80 dark:border-neutral-600"
        >{{ bankTransferDisplay }}</pre>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div
          v-if="error"
          class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm"
        >
          {{ error }}
        </div>

        <div>
          <label class="block text-sm font-medium text-black dark:text-white mb-1">
            {{ $t('checkout.payment_slip.amount_label') }}
          </label>
          <p class="text-lg font-semibold text-alizarin-crimson-600 dark:text-alizarin-crimson-400">
            ฿{{ amount || '—' }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-black dark:text-white mb-1">
            {{ $t('checkout.payment_slip.slip_data_label') }}
          </label>
          <textarea
            v-model="slipData"
            rows="4"
            class="w-full rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/30 px-4 py-3 text-black dark:text-white text-sm font-mono leading-relaxed"
            :placeholder="$t('checkout.payment_slip.slip_data_placeholder')"
          />
          <p class="mt-1 text-xs text-neutral-500">
            {{ $t('checkout.payment_slip.slip_data_hint') }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-black dark:text-white mb-1">
            {{ $t('checkout.payment_slip.file_label') }}
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            class="block w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-alizarin-crimson-600 file:text-white"
            @change="onFileChange"
          />
          <p class="mt-1 text-xs text-neutral-500">
            {{ $t('checkout.payment_slip.file_hint') }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-black dark:text-white mb-1">
            {{ $t('checkout.payment_slip.optional_url') }}
          </label>
          <input
            v-model="slipUrl"
            type="url"
            class="w-full rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/30 px-4 py-3 text-black dark:text-white text-sm"
            :placeholder="$t('checkout.payment_slip.url_placeholder')"
          />
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <span v-if="!submitting">{{ $t('checkout.payment_slip.upload_btn') }}</span>
          <span v-else class="inline-flex items-center justify-center gap-2">
            <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-5 h-5" />
            {{ $t('checkout.payment_slip.uploading') }}
          </span>
        </button>

        <NuxtLink
          :to="localePath('/')"
          class="block text-center text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
        >
          {{ $t('checkout.payment_slip.back_home') }}
        </NuxtLink>
      </form>
    </div>
  </div>
</template>
