<script setup>
import { push } from 'notivue';
import { buildPromptPayQrDataUrl } from "~/utils/promptpayDynamicQr";

definePageMeta({
  ssr: false,
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const localePath = useLocalePath();
const {
  submitBankSlip,
  order,
  userDetails,
  loadCustomerData,
  isLoadingCustomerData,
  createOrderFromCart,
  error,
} = useCheckout();
const { isAuthenticated, checkAuth } = useAuth();
const { cart } = useCart();
const config = useRuntimeConfig();

/** มี order แล้ว (มาจาก my-orders / ลิงก์เดิม) — แค่อัปโหลดสลิป */
const isResumePay = computed(() => Boolean(String(route.query.order_id || '').trim()));

const orderId = computed(() => String(route.query.order_id || ''));
const amountFromQuery = computed(() => String(route.query.amount || ''));

/** สั่งซื้อใหม่จากตะกร้า — กรอกฟอร์ม + สร้างออเดอร์บนหน้านี้ */
const isNewCheckout = computed(() => !isResumePay.value);

/** แสดงบล็อกข้อมูลผู้สั่งซื้อ: สั่งใหม่ หรือกลับมาอัปโหลดสลิป (โหลดจากบัญชี) */
const showBuyerForm = computed(() => isNewCheckout.value || isResumePay.value);

/** รูป QR สำรองเมื่อไม่ได้ตั้ง NUXT_PUBLIC_PROMPTPAY_ID หรือสร้าง QR ไม่สำเร็จ */
const fallbackQrSrc = computed(() => {
  const u = String(config.public.promptpayQrImageUrl || '').trim();
  return u || '/images/promptpay-qr.png';
});

const effectivePromptPayId = computed(() =>
  normalizePromptPayId(String(config.public.promptpayId || "").trim())
);

const qrDataUrl = ref(null);
const qrGenerating = ref(false);

const bankTransferDisplay = computed(() => {
  const fromEnv = String(config.public.storeBankTransferInfo || '').trim();
  return fromEnv || t('checkout.payment_slip.bank_account_default');
});

const slipFile = ref(null);
const submitting = ref(false);

/** รหัสธนาคาร — ต้องตรงกับคีย์ใน i18n `checkout.payment_slip.bank_options.*` */
const TRANSFER_BANK_KEYS = [
  'BBL',
  'KBANK',
  'SCB',
  'KTB',
  'BAY',
  'TTB',
  'CIMBT',
  'UOBT',
  'LHBANK',
  'ICBCT',
  'GSB',
  'BAAC',
  'GHB',
  'EXIM',
  'IBANK',
  'SME',
];

const BBL_COOLDOWN_MS = 8 * 60 * 1000;
const OTHER_BANK_COOLDOWN_MS = 15 * 1000;

const transferBankKey = ref('');
/** เวลาที่อนุญาตให้กดส่งสลิปได้ (epoch ms) */
const cooldownUntilMs = ref(0);
const nowMs = ref(Date.now());
let cooldownTicker = null;

const cooldownRemainingMs = computed(() =>
  Math.max(0, cooldownUntilMs.value - nowMs.value)
);

function formatCooldown(ms) {
  const sec = Math.ceil(ms / 1000);
  if (sec <= 0) return '0';
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${sec}`;
}

const showCooldownModal = ref(false);
const showSlipErrorModal = ref(false);
const slipErrorModalText = ref('');

const cooldownModalTitle = computed(() =>
  transferBankKey.value === 'BBL'
    ? t('checkout.payment_slip.bbl_modal_title')
    : t('checkout.payment_slip.cooldown_modal_title')
);

const cooldownModalBody = computed(() =>
  transferBankKey.value === 'BBL'
    ? t('checkout.payment_slip.bbl_modal_body')
    : t('checkout.payment_slip.cooldown_other_banks_hint')
);

function openSlipErrorModal(text) {
  slipErrorModalText.value = text;
  showSlipErrorModal.value = true;
  error.value = null;
}

function closeSlipErrorModal() {
  showSlipErrorModal.value = false;
  slipErrorModalText.value = '';
}

function onTransferBankChange() {
  error.value = null;
  const key = transferBankKey.value;
  if (!key) {
    cooldownUntilMs.value = 0;
    showCooldownModal.value = false;
    return;
  }
  const wait = key === 'BBL' ? BBL_COOLDOWN_MS : OTHER_BANK_COOLDOWN_MS;
  cooldownUntilMs.value = Date.now() + wait;
  showCooldownModal.value = true;
}

function assertBankAndCooldown() {
  if (!transferBankKey.value) {
    error.value = t('checkout.payment_slip.bbl_bank_required');
    return false;
  }
  if (cooldownRemainingMs.value > 0) {
    showCooldownModal.value = true;
    return false;
  }
  return true;
}

watch(cooldownRemainingMs, (ms) => {
  if (ms <= 0 && showCooldownModal.value) {
    showCooldownModal.value = false;
  }
});

const parsePrice = (priceString) => {
  if (!priceString) return 0;
  const cleaned = String(priceString).replace(/<[^>]*>/g, '').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const cartTotal = computed(() => {
  const list = cart.value || [];
  if (!list.length) return '0.00';
  const total = list.reduce((acc, item) => {
    const node = item.variation?.node || item.product?.node || {};
    const r = parsePrice(node.regularPrice);
    const s = parsePrice(node.salePrice);
    const price = s > 0 && s < r ? s : r;
    return acc + price * (item.quantity || 1);
  }, 0);
  return total.toFixed(2);
});

/** ยอดที่แสดง: ออเดอร์เดิมจาก query / ตะกร้าก่อนสั่ง */
const displayAmount = computed(() => {
  if (isResumePay.value) return amountFromQuery.value;
  return cartTotal.value;
});

async function refreshPromptPayQr() {
  const id = effectivePromptPayId.value;
  if (!id) {
    qrDataUrl.value = null;
    qrGenerating.value = false;
    return;
  }
  qrGenerating.value = true;
  try {
    let amount;
    if (config.public.promptpayQrIncludeAmount) {
      const n = parseFloat(String(displayAmount.value || "").replace(/[^0-9.]/g, ""));
      if (Number.isFinite(n) && n > 0) amount = n;
    }
    qrDataUrl.value = await buildPromptPayQrDataUrl(
      id,
      amount != null ? { amount } : undefined
    );
  } finally {
    qrGenerating.value = false;
  }
}

watch(
  () => [
    effectivePromptPayId.value,
    config.public.promptpayQrIncludeAmount,
    displayAmount.value,
  ],
  () => {
    refreshPromptPayQr();
  },
  { immediate: true }
);

onMounted(async () => {
  cooldownTicker = setInterval(() => {
    nowMs.value = Date.now();
  }, 250);
  checkAuth();
  if (!isAuthenticated.value) {
    router.replace(localePath('/'));
    return;
  }
  if (isResumePay.value) {
    if (!orderId.value) {
      router.replace(localePath('/'));
      return;
    }
    await loadCustomerData();
    return;
  }
  if (!cart.value?.length) {
    router.replace(localePath('/'));
    return;
  }
  await loadCustomerData();
});

onUnmounted(() => {
  if (cooldownTicker) {
    clearInterval(cooldownTicker);
    cooldownTicker = null;
  }
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
  const id =
    effectivePromptPayId.value || t("checkout.payment_slip.promptpay_number");
  copyToClipboard(id);
}

function copyBankDetails() {
  copyToClipboard(bankTransferDisplay.value);
}

function onFileChange(e) {
  const f = e.target?.files?.[0];
  slipFile.value = f || null;
  error.value = null;
}

function yardsaleErrorPayload(err) {
  if (!err || typeof err !== "object") return null;
  return err.data ?? err.response?._data ?? err.response?.data ?? null;
}

function slipErrorMessage(err) {
  const payload = yardsaleErrorPayload(err);
  const errPart = payload?.error ?? (payload?.data && typeof payload.data === "object" ? payload.data.error : null);
  const code =
    errPart?.code ||
    payload?.code ||
    err?.data?.error?.code ||
    err?.data?.code ||
    err?.response?._data?.error?.code;
  const serverMsg =
    errPart?.message ||
    payload?.message ||
    err?.data?.error?.message ||
    err?.response?._data?.error?.message ||
    err?.message ||
    "";
  if (code === 'SLIP_BANK_DELAY') {
    const delayMsg = t('checkout.payment_slip.errors.SLIP_BANK_DELAY');
    if (delayMsg !== 'checkout.payment_slip.errors.SLIP_BANK_DELAY') return delayMsg;
  }
  const trimmed = String(serverMsg || '').trim();
  /** ข้อความจาก SlipOK มักละเอียดกว่า — แสดงก่อนข้อความทั่วไปของ SLIP_INVALID */
  if (trimmed && !/^slip verification failed$/i.test(trimmed)) {
    if (!code || code === 'SLIP_INVALID') return trimmed;
  }
  if (code) {
    const msg = t(`checkout.payment_slip.errors.${code}`);
    if (msg !== `checkout.payment_slip.errors.${code}`) return msg;
  }
  return trimmed || t('checkout.payment_slip.errors.generic');
}

function validateBuyerForm() {
  const u = userDetails.value;
  return !!(
    u.email &&
    u.firstName &&
    u.lastName &&
    u.phone &&
    u.address1 &&
    u.city
  );
}

/** ส่งสลิปเมื่อมี order อยู่แล้ว  */
async function onSubmitResumeOnly() {
  error.value = null;
  if (!assertBankAndCooldown()) return;
  if (!slipFile.value) {
    error.value = t('checkout.payment_slip.errors.FILE_REQUIRED');
    return;
  }
  submitting.value = true;
  try {
    const res = await submitBankSlip({
      orderId: orderId.value,
      amount: amountFromQuery.value,
      file: slipFile.value || undefined,
      transferBank: transferBankKey.value,
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
      push.success(t('checkout.payment_slip.verify_success_toast'));
      await router.push(
        localePath({
          path: '/payment-successful',
          query: { order_id: orderId.value, slip_verified: '1' },
        })
      );
      return;
    }
    openSlipErrorModal(t('checkout.payment_slip.errors.generic'));
  } catch (err) {
    openSlipErrorModal(slipErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

/** สั่งซื้อใหม่: สร้างออเดอร์ + (สลิปถ้าโอนเงิน) */
async function onSubmitNew() {
  error.value = null;
  if (!validateBuyerForm()) {
    error.value = t('checkout.error.incomplete_data');
    return;
  }

  if (!assertBankAndCooldown()) return;

  if (!slipFile.value) {
    error.value = t('checkout.payment_slip.errors.FILE_REQUIRED');
    return;
  }

  submitting.value = true;
  try {
    const orderData = await createOrderFromCart('bank_transfer');
    if (!orderData?.id) {
      return;
    }

    const amt = String(orderData.total_price ?? orderData.total ?? '');
    const res = await submitBankSlip({
      orderId: String(orderData.id),
      amount: amt,
      file: slipFile.value || undefined,
      transferBank: transferBankKey.value,
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
      push.success(t('checkout.payment_slip.verify_success_toast'));
      await router.push(
        localePath({
          path: '/payment-successful',
          query: { order_id: String(orderData.id), slip_verified: '1' },
        })
      );
      return;
    }
    openSlipErrorModal(t('checkout.payment_slip.errors.generic'));
  } catch (err) {
    openSlipErrorModal(slipErrorMessage(err));
  } finally {
    submitting.value = false;
  }
}

async function onSubmit() {
  if (isResumePay.value) {
    await onSubmitResumeOnly();
  } else {
    await onSubmitNew();
  }
}

const submitButtonText = computed(() => {
  const base = isResumePay.value
    ? t('checkout.payment_slip.upload_btn')
    : t('checkout.payment_slip.submit_place_order_bank');
  if (cooldownRemainingMs.value > 0) {
    return `${base} (${formatCooldown(cooldownRemainingMs.value)})`;
  }
  return base;
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black py-8 px-4">
    <div class="max-w-lg mx-auto">
      <h1 class="text-2xl font-bold text-black dark:text-white mb-2">
        {{ $t('checkout.payment_slip.title') }}
      </h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
        <template v-if="isResumePay">
          {{
            $t('checkout.payment_slip.subtitle', {
              n: orderId || '—',
              amount: displayAmount || '—',
            })
          }}
        </template>
        <template v-else>
          {{ $t('checkout.pay.continue_hint') }}
        </template>
      </p>

      <div
        v-if="isLoadingCustomerData && showBuyerForm"
        class="flex justify-center py-12"
      >
        <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-10 h-10 text-neutral-400" />
      </div>

      <template v-else>
        <!-- ฟอร์มผู้สั่งซื้อ — สั่งใหม่จากตะกร้า หรือกลับมาอัปโหลดสลิป (โหลดจากบัญชี แก้ไขได้) -->
        <div
          v-if="showBuyerForm"
          class="mb-6 p-4 rounded-2xl bg-white/90 dark:bg-black/40 border-2 border-neutral-200 dark:border-neutral-700"
        >
          <h2 class="text-sm font-semibold text-black dark:text-white mb-3">
            {{ $t('checkout.payment_slip.billing_title') }}
          </h2>
          <p
            v-if="isResumePay"
            class="mb-3 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed"
          >
            {{ $t('checkout.payment_slip.billing_resume_note') }}
          </p>
          <div class="grid grid-cols-2 gap-3 billing">
            <div class="col-span-full">
              <label
                for="payment-billing-email"
                class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              >{{ $t('checkout.form.email') }}</label>
              <input
                id="payment-billing-email"
                v-model="userDetails.email"
                required
                type="email"
                :placeholder="$t('checkout.form.email')"
              />
            </div>
            <div class="col-span-1">
              <label
                for="payment-billing-firstname"
                class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              >{{ $t('checkout.form.first_name') }}</label>
              <input
                id="payment-billing-firstname"
                v-model="userDetails.firstName"
                required
                type="text"
                :placeholder="$t('checkout.form.first_name')"
              />
            </div>
            <div class="col-span-1">
              <label
                for="payment-billing-lastname"
                class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              >{{ $t('checkout.form.last_name') }}</label>
              <input
                id="payment-billing-lastname"
                v-model="userDetails.lastName"
                required
                type="text"
                :placeholder="$t('checkout.form.last_name')"
              />
            </div>
            <div class="col-span-1">
              <label
                for="payment-billing-phone"
                class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              >{{ $t('checkout.form.phone') }}</label>
              <input
                id="payment-billing-phone"
                v-model="userDetails.phone"
                required
                type="tel"
                :placeholder="$t('checkout.form.phone')"
              />
            </div>
            <div class="col-span-1">
              <label
                for="payment-billing-city"
                class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              >{{ $t('checkout.form.city') }}</label>
              <input
                id="payment-billing-city"
                v-model="userDetails.city"
                required
                type="text"
                :placeholder="$t('checkout.form.city')"
              />
            </div>
            <div class="col-span-full">
              <label
                for="payment-billing-address1"
                class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              >{{ $t('checkout.form.address') }}</label>
              <textarea
                id="payment-billing-address1"
                v-model="userDetails.address1"
                required
                rows="2"
                :placeholder="$t('checkout.form.address')"
              />
            </div>
            <div class="col-span-full">
              <label
                for="payment-billing-address2"
                class="block text-sm font-medium text-black dark:text-white mb-1"
              >{{ $t('checkout.form.address2') }}</label>
              <input
                id="payment-billing-address2"
                v-model="userDetails.address2"
                type="text"
                :placeholder="$t('checkout.form.address2')"
              />
            </div>
            <div class="col-span-1">
              <label
                for="payment-billing-state"
                class="block text-sm font-medium text-black dark:text-white mb-1"
              >{{ $t('checkout.form.state') }}</label>
              <input
                id="payment-billing-state"
                v-model="userDetails.state"
                type="text"
                :placeholder="$t('checkout.form.state')"
              />
            </div>
            <div class="col-span-1">
              <label
                for="payment-billing-postcode"
                class="block text-sm font-medium text-black dark:text-white mb-1"
              >{{ $t('checkout.form.postcode') }}</label>
              <input
                id="payment-billing-postcode"
                v-model="userDetails.postcode"
                type="text"
                :placeholder="$t('checkout.form.postcode')"
              />
            </div>
          </div>
          <p v-if="showBuyerForm" class="mt-3 text-xs text-neutral-500">
            {{ $t('checkout.payment_slip.method_label') }}:
            <span class="font-semibold text-black dark:text-white">{{
              $t('checkout.payment_method.bank_transfer')
            }}</span>
          </p>
        </div>

        <div
          class="mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100"
        >
          {{ $t('checkout.payment_slip.instructions') }}
        </div>

        <!-- QR + บัญชี — เฉพาะโอนเงิน -->
        <div
          class="mb-6 p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-black/40 border-2 border-neutral-200 dark:border-neutral-700"
        >
          <h2 class="text-sm font-semibold text-black dark:text-white mb-4">
            {{ $t('checkout.payment_slip.bank_section_title') }}
          </h2>

          <div class="flex flex-col items-center mb-4">
            <div
              class="rounded-2xl overflow-hidden bg-white p-3 shadow-lg border border-neutral-200 dark:border-neutral-600 max-w-[min(100%,280px)] w-full min-h-[280px] flex items-center justify-center"
            >
              <UIcon
                v-if="effectivePromptPayId && qrGenerating"
                name="i-svg-spinners-90-ring-with-bg"
                class="w-12 h-12 text-neutral-400"
              />
              <img
                v-else
                :src="
                  effectivePromptPayId && qrDataUrl ? qrDataUrl : fallbackQrSrc
                "
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
            <p
              v-if="effectivePromptPayId && config.public.promptpayQrIncludeAmount"
              class="mt-2 text-xs text-amber-800 dark:text-amber-200/90 text-center px-2 leading-relaxed max-w-sm mx-auto"
            >
              {{ $t('checkout.payment_slip.qr_dynamic_scan_hint') }}
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
          <p class="text-xs text-neutral-500 dark:text-neutral-400 px-1">
            {{ $t('checkout.payment_slip.outcome_hint') }}
          </p>
          <div
            v-if="error"
            class="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm"
          >
            <p class="font-semibold text-red-800 dark:text-red-200 mb-1">
              {{ $t('checkout.payment_slip.result_error_title') }}
            </p>
            <p class="text-xs text-red-600/90 dark:text-red-300/90 mb-2">
              {{ $t('checkout.payment_slip.result_error_hint') }}
            </p>
            <p class="text-red-700 dark:text-red-300 leading-relaxed">
              {{ error }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-black dark:text-white mb-1">
              {{
                isNewCheckout
                  ? $t('checkout.payment_slip.cart_total_preview')
                  : $t('checkout.payment_slip.amount_label')
              }}
            </label>
            <p class="text-lg font-semibold text-alizarin-crimson-600 dark:text-alizarin-crimson-400">
              ฿{{ displayAmount || '—' }}
            </p>
          </div>

          <div>
            <label
              class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
              for="payment-transfer-bank"
            >
              {{ $t('checkout.payment_slip.bbl_bank_label') }}
            </label>
            <select
              id="payment-transfer-bank"
              v-model="transferBankKey"
              required
              class="payment-slip-select w-full rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/30 px-4 py-3 text-sm text-black dark:text-white"
              @change="onTransferBankChange"
            >
              <option value="">{{ $t('checkout.payment_slip.bbl_bank_placeholder') }}</option>
              <option
                v-for="bk in TRANSFER_BANK_KEYS"
                :key="bk"
                :value="bk"
              >
                {{ $t(`checkout.payment_slip.bank_options.${bk}`) }}
              </option>
            </select>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {{ $t('checkout.payment_slip.bbl_bank_hint') }}
            </p>
          </div>

          <div>
            <label
              for="payment-slip-file"
              class="block text-sm font-medium text-black dark:text-white mb-1 form-required-after"
            >
              {{ $t('checkout.payment_slip.file_label') }}
            </label>
            <input
              id="payment-slip-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              class="block w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-alizarin-crimson-600 file:text-white"
              @change="onFileChange"
            />
            <p class="mt-1 text-xs text-neutral-500">
              {{ $t('checkout.payment_slip.file_hint') }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="
              submitting ||
              (showBuyerForm && isLoadingCustomerData) ||
              !transferBankKey ||
              cooldownRemainingMs > 0 ||
              !slipFile
            "
            class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <span v-if="!submitting">{{ submitButtonText }}</span>
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
      </template>

      <UModal
        v-model="showCooldownModal"
        :ui="{
          overlay: {
            background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
          },
          width: 'w-full sm:max-w-md',
        }"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-bold text-black dark:text-white pr-2">
              {{ cooldownModalTitle }}
            </h3>
            <button
              type="button"
              class="p-2 shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
              @click="showCooldownModal = false"
            >
              <UIcon
                name="i-heroicons-x-mark"
                class="w-5 h-5 text-neutral-500 dark:text-neutral-400"
              />
            </button>
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-4">
            {{ cooldownModalBody }}
          </p>
          <p
            class="text-center text-4xl font-mono font-bold text-amber-800 dark:text-amber-200 tabular-nums mb-6"
          >
            {{ formatCooldown(cooldownRemainingMs) }}
          </p>
          <button
            type="button"
            class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition"
            @click="showCooldownModal = false"
          >
            {{ $t('checkout.payment_slip.bbl_understood') }}
          </button>
        </div>
      </UModal>

      <UModal
        v-model="showSlipErrorModal"
        :ui="{
          overlay: {
            background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
          },
          width: 'w-full sm:max-w-md',
        }"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-black dark:text-white">
              {{ $t('checkout.payment_slip.result_error_title') }}
            </h3>
            <button
              type="button"
              class="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
              @click="closeSlipErrorModal"
            >
              <UIcon
                name="i-heroicons-x-mark"
                class="w-5 h-5 text-neutral-500 dark:text-neutral-400"
              />
            </button>
          </div>
          <div class="mb-6">
            <div
              class="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full"
            >
              <UIcon
                name="i-heroicons-exclamation-triangle"
                class="w-8 h-8 text-red-600 dark:text-red-400"
              />
            </div>
            <p class="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
              {{ $t('checkout.payment_slip.result_error_hint') }}
            </p>
            <p class="text-sm text-red-700 dark:text-red-300 leading-relaxed whitespace-pre-wrap">
              {{ slipErrorModalText }}
            </p>
          </div>
          <button
            type="button"
            class="w-full py-3 rounded-xl font-semibold text-white bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 transition"
            @click="closeSlipErrorModal"
          >
            {{ $t('checkout.payment_slip.bbl_understood') }}
          </button>
        </div>
      </UModal>
    </div>
  </div>
</template>

<style lang="postcss">
:root {
  --background: #fff;
  --border: #ccc;
}

.dark {
  --background: #000;
  --border: #999;
}

input:-webkit-autofill,
textarea:-webkit-autofill,
select:-webkit-autofill {
  -webkit-box-shadow: 0 0 0px 1000px var(--background, #fff) inset !important;
  box-shadow: 0 0 0px 1000px var(--background, #fff) inset !important;
  border-color: var(--border) !important;
}

.billing input,
.billing textarea {
  @apply block bg-white/80 dark:bg-black/20 dark:border-white/20 w-full shadow font-semibold border-2 border-transparent transition hover:border-black dark:hover:border-white rounded-2xl py-3 px-4 text-black dark:text-white placeholder:text-neutral-400 text-sm leading-6 focus-visible:outline-none focus-visible:border-black focus-visible:dark:border-white;
}

.payment-slip-select {
  @apply focus-visible:outline-none focus-visible:border-alizarin-crimson-600 dark:focus-visible:border-alizarin-crimson-500;
}

textarea {
  resize: none;
}
</style>
