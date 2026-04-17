<script setup>
import { nextTick } from 'vue';
import { push } from 'notivue';
import { buildPromptPayQrDataUrl } from "~/utils/promptpayDynamicQr";
import { messageFromYardsaleBody } from "~/utils/cmsApiEndpoint";

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
  paymentMethod,
} = useCheckout();
const { isAuthenticated, checkAuth, user } = useAuth();
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
/** object URL สำหรับแสดงตัวอย่างรูป — revoke เมื่อเปลี่ยน/เลิกใช้ */
const slipPreviewUrl = ref(null);
const slipUrl = ref('');
const slipData = ref('');
const submitting = ref(false);

/** BBL — รอ 8 นาที; ธนาคารอื่น — รอ 15 วินาที (ตามที่ระบุ "15วิ") */
const BBL_COOLDOWN_MS = 8 * 60 * 1000;
const OTHER_BANK_COOLDOWN_MS = 15 * 1000;

/** รหัสธนาคารต้นทางที่โอน (แสดงใน select) */
const TRANSFER_BANK_CODES = [
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

const bblModalOpen = ref(false);
const bblCooldownUntil = ref(null);
const bblTick = ref(0);
const bblTickTimerRef = ref(null);
const selectedBank = ref('');
const bankWatchPaused = ref(false);

function transferBankCooldownMs(code) {
  return code === 'BBL' ? BBL_COOLDOWN_MS : OTHER_BANK_COOLDOWN_MS;
}

function readTransferBankCode(uid) {
  if (!import.meta.client || !uid) return '';
  try {
    const v = sessionStorage.getItem(`yardsale_bank_code_${uid}`);
    return v && TRANSFER_BANK_CODES.includes(v) ? v : '';
  } catch {
    return '';
  }
}

function writeTransferBankCode(uid, code) {
  if (!import.meta.client || !uid) return;
  try {
    if (code) sessionStorage.setItem(`yardsale_bank_code_${uid}`, code);
    else sessionStorage.removeItem(`yardsale_bank_code_${uid}`);
  } catch {
    /* private mode */
  }
}

function slipErrorCode(err) {
  return (
    err?.data?.error?.code ||
    err?.data?.code ||
    err?.response?._data?.error?.code ||
    null
  );
}

function readBblStored(suffix) {
  if (!import.meta.client) return 0;
  try {
    const v = sessionStorage.getItem(`yardsale_bbl_${suffix}`);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeBblStored(suffix, until) {
  if (!import.meta.client) return;
  try {
    sessionStorage.setItem(`yardsale_bbl_${suffix}`, String(until));
  } catch {
    /* private mode */
  }
}

function stopBblTick() {
  if (bblTickTimerRef.value != null) {
    clearInterval(bblTickTimerRef.value);
    bblTickTimerRef.value = null;
  }
}

function bblRemainingSeconds() {
  const u = bblCooldownUntil.value;
  if (!u) return 0;
  return Math.max(0, Math.ceil((u - Date.now()) / 1000));
}

const bblSubmitBlocked = computed(() => {
  bblTick.value;
  return bblRemainingSeconds() > 0;
});

const bblCountdownFormatted = computed(() => {
  bblTick.value;
  const s = bblRemainingSeconds();
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
});

function startBblTick() {
  stopBblTick();
  bblTick.value = Date.now();
  bblTickTimerRef.value = setInterval(() => {
    bblTick.value = Date.now();
    const u = bblCooldownUntil.value;
    if (!u || Date.now() >= u) {
      stopBblTick();
      bblCooldownUntil.value = null;
      bblModalOpen.value = false;
    }
  }, 1000);
}

/** จากเซิร์ฟเวอร์ SLIP_BANK_DELAY — ถือว่าเป็นคิว BBL (8 นาที) */
function armOrderBblCooldown(suffix) {
  const now = Date.now();
  const proposedEnd = now + BBL_COOLDOWN_MS;
  const currentEnd =
    bblCooldownUntil.value && bblCooldownUntil.value > now
      ? bblCooldownUntil.value
      : 0;
  const until = Math.max(proposedEnd, currentEnd);
  bblCooldownUntil.value = until;
  writeBblStored(suffix, until);
  bblModalOpen.value = true;
  startBblTick();
}

function restoreBblCooldownFromStorage() {
  if (!import.meta.client) return;
  const now = Date.now();
  const oid = String(orderId.value || '').trim();
  let until = 0;
  if (oid) until = Math.max(until, readBblStored(`order_${oid}`));

  const uid = user.value?.id;
  let savedBank = '';
  if (uid) {
    let prefillT = readBblStored(`prefill_${uid}`);
    savedBank = readTransferBankCode(uid);
    if (prefillT > now && !savedBank) {
      try {
        sessionStorage.removeItem(`yardsale_bbl_prefill_${uid}`);
      } catch {
        /* ignore */
      }
      prefillT = 0;
    }
    until = Math.max(until, prefillT);
  }

  bankWatchPaused.value = true;
  if (savedBank) selectedBank.value = savedBank;

  if (until > now) {
    bblCooldownUntil.value = until;
    const rem = until - now;
    const prefillEnd = uid ? readBblStored(`prefill_${uid}`) : 0;
    const orderEnd = oid ? readBblStored(`order_${oid}`) : 0;
    const dominatedByOrder = orderEnd > now && orderEnd >= prefillEnd;
    const bankForModal = selectedBank.value || (dominatedByOrder ? 'BBL' : '');
    bblModalOpen.value = rem > 60_000 && (bankForModal === 'BBL' || dominatedByOrder);
    startBblTick();
  } else {
    bblCooldownUntil.value = null;
    bblModalOpen.value = false;
  }
  nextTick(() => {
    bankWatchPaused.value = false;
  });
}

function applyOrderOnlyCooldownState() {
  if (!import.meta.client) return;
  const now = Date.now();
  let until = 0;
  const oid = String(orderId.value || '').trim();
  if (oid) {
    const t = readBblStored(`order_${oid}`);
    if (t > now) until = t;
  }
  if (until > now) {
    bblCooldownUntil.value = until;
    const rem = until - now;
    bblModalOpen.value = rem > 60_000;
    startBblTick();
  } else {
    bblCooldownUntil.value = null;
    stopBblTick();
    bblModalOpen.value = false;
  }
}

/** ล้างคูลดาวน์จากการเลือกธนาคาร + ล้างรหัสธนาคารใน session (เมื่อเลือกว่าง) */
function recalculateAfterPrefillCleared() {
  if (!import.meta.client) return;
  const uid = user.value?.id;
  if (uid) {
    try {
      sessionStorage.removeItem(`yardsale_bbl_prefill_${uid}`);
    } catch {
      /* ignore */
    }
    writeTransferBankCode(uid, '');
  }
  applyOrderOnlyCooldownState();
}

/** คูลดาวน์ BBL / ธนาคารอื่น — เริ่มทันทีเมื่อเลือกธนาคารใน select */
function armBankSelectCooldown() {
  if (!import.meta.client || bankWatchPaused.value) return;
  const uid = user.value?.id;
  if (!uid) return;

  const code = String(selectedBank.value || '').trim();

  if (!code) {
    try {
      sessionStorage.removeItem(`yardsale_bbl_prefill_${uid}`);
    } catch {
      /* ignore */
    }
    writeTransferBankCode(uid, '');
    applyOrderOnlyCooldownState();
    return;
  }

  writeTransferBankCode(uid, code);

  try {
    sessionStorage.removeItem(`yardsale_bbl_prefill_${uid}`);
  } catch {
    /* ignore */
  }

  const ms = transferBankCooldownMs(code);
  const now = Date.now();
  const prefillEnd = now + ms;
  writeBblStored(`prefill_${uid}`, prefillEnd);

  const oid = String(orderId.value || '').trim();
  const orderEnd = oid ? readBblStored(`order_${oid}`) : 0;
  const orderActive = orderEnd > now ? orderEnd : 0;
  const finalUntil = Math.max(prefillEnd, orderActive);
  const dominatedByOrder = orderActive > 0 && orderActive >= prefillEnd;

  bblCooldownUntil.value = finalUntil;
  bblModalOpen.value = code === 'BBL' || dominatedByOrder;
  startBblTick();
}

watch(selectedBank, (code) => {
  if (!import.meta.client || bankWatchPaused.value) return;
  const uid = user.value?.id;
  if (!uid) return;

  if (!code) {
    recalculateAfterPrefillCleared();
    return;
  }
  writeTransferBankCode(uid, code);
  armBankSelectCooldown();
});

function revokeSlipPreview() {
  if (slipPreviewUrl.value) {
    URL.revokeObjectURL(slipPreviewUrl.value);
    slipPreviewUrl.value = null;
  }
}

onUnmounted(() => {
  revokeSlipPreview();
  stopBblTick();
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
    restoreBblCooldownFromStorage();
    return;
  }
  if (!cart.value?.length) {
    router.replace(localePath('/'));
    return;
  }
  paymentMethod.value = 'bank_transfer';
  await loadCustomerData();
  restoreBblCooldownFromStorage();
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
  revokeSlipPreview();
  const f = e.target?.files?.[0] || null;
  slipFile.value = f;
  error.value = null;
  if (f && typeof f.type === 'string' && f.type.startsWith('image/')) {
    slipPreviewUrl.value = URL.createObjectURL(f);
  }
}

const slipIsPdf = computed(
  () => slipFile.value && String(slipFile.value.type || '').includes('pdf')
);
const slipIsImage = computed(
  () =>
    slipFile.value &&
    typeof slipFile.value.type === 'string' &&
    slipFile.value.type.startsWith('image/')
);

function slipErrorMessage(err) {
  const payload = err?.data ?? err?.response?._data;
  if (payload && typeof payload === "object") {
    const fromEnvelope = messageFromYardsaleBody(payload, "");
    if (fromEnvelope) return fromEnvelope;
  }
  const code =
    err?.data?.error?.code ||
    err?.data?.code ||
    err?.response?._data?.error?.code;
  const serverMsg =
    err?.data?.error?.message ||
    err?.response?._data?.error?.message ||
    err?.message ||
    '';
  if (code === 'SLIP_BANK_DELAY') {
    const delayMsg = t('checkout.payment_slip.errors.SLIP_BANK_DELAY');
    if (delayMsg !== 'checkout.payment_slip.errors.SLIP_BANK_DELAY') return delayMsg;
  }
  if (code) {
    const msg = t(`checkout.payment_slip.errors.${code}`);
    if (msg !== `checkout.payment_slip.errors.${code}`) return msg;
  }
  return serverMsg || t('checkout.payment_slip.errors.generic');
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
  if (!String(selectedBank.value || '').trim()) {
    error.value = t('checkout.payment_slip.bbl_bank_required');
    return;
  }
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
      amount: amountFromQuery.value,
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
      cart.value = [];
      if (import.meta.client) {
        try {
          localStorage.setItem('cart', JSON.stringify([]));
        } catch {
          /* private mode */
        }
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
    error.value = res?.slip_verification_incomplete
      ? t('checkout.payment_slip.errors.VERIFY_RESPONSE_MISSING')
      : t('checkout.payment_slip.errors.generic');
  } catch (err) {
    error.value = slipErrorMessage(err);
    if (slipErrorCode(err) === 'SLIP_BANK_DELAY' && orderId.value) {
      armOrderBblCooldown(`order_${orderId.value}`);
    }
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
  if (!String(selectedBank.value || '').trim()) {
    error.value = t('checkout.payment_slip.bbl_bank_required');
    return;
  }

  const hasFile = !!slipFile.value;
  const hasUrl = !!String(slipUrl.value || '').trim();
  const hasData = !!String(slipData.value || '').trim();
  if (!hasFile && !hasUrl && !hasData) {
    error.value = t('checkout.payment_slip.errors.PAYMENT_PROOF_REQUIRED');
    return;
  }

  submitting.value = true;
  let createdOrderId = null;
  try {
    const orderData = await createOrderFromCart('bank_transfer', { clearCart: false });
    if (!orderData?.id) {
      return;
    }
    createdOrderId = String(orderData.id);

    const amt = String(orderData.total_price ?? orderData.total ?? '');
    const res = await submitBankSlip({
      orderId: String(orderData.id),
      amount: amt,
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
      cart.value = [];
      if (import.meta.client) {
        try {
          localStorage.setItem('cart', JSON.stringify([]));
        } catch {
          /* private mode */
        }
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
    error.value = res?.slip_verification_incomplete
      ? t('checkout.payment_slip.errors.VERIFY_RESPONSE_MISSING')
      : t('checkout.payment_slip.errors.generic');
  } catch (err) {
    error.value = slipErrorMessage(err);
    if (slipErrorCode(err) === 'SLIP_BANK_DELAY' && createdOrderId) {
      armOrderBblCooldown(`order_${createdOrderId}`);
    }
  } finally {
    submitting.value = false;
  }
}

async function onSubmit() {
  if (bblSubmitBlocked.value) return;
  if (isResumePay.value) {
    await onSubmitResumeOnly();
  } else {
    await onSubmitNew();
  }
}

const submitLabel = computed(() =>
  isResumePay.value
    ? t('checkout.payment_slip.upload_btn')
    : t('checkout.payment_slip.submit_place_order_bank')
);
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
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 form-required-after"
                >{{ $t('checkout.form.email') }}</label
              >
              <input
                v-model="userDetails.email"
                required
                type="email"
                :placeholder="$t('checkout.form.email')"
              />
            </div>
            <div class="col-span-1">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 form-required-after"
                >{{ $t('checkout.form.first_name') }}</label
              >
              <input
                v-model="userDetails.firstName"
                required
                type="text"
                :placeholder="$t('checkout.form.first_name')"
              />
            </div>
            <div class="col-span-1">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 form-required-after"
                >{{ $t('checkout.form.last_name') }}</label
              >
              <input
                v-model="userDetails.lastName"
                required
                type="text"
                :placeholder="$t('checkout.form.last_name')"
              />
            </div>
            <div class="col-span-1">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 form-required-after"
                >{{ $t('checkout.form.phone') }}</label
              >
              <input
                v-model="userDetails.phone"
                required
                type="tel"
                :placeholder="$t('checkout.form.phone')"
              />
            </div>
            <div class="col-span-1">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 form-required-after"
                >{{ $t('checkout.form.city') }}</label
              >
              <input
                v-model="userDetails.city"
                required
                type="text"
                :placeholder="$t('checkout.form.city')"
              />
            </div>
            <div class="col-span-full">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1 form-required-after"
                >{{ $t('checkout.form.address') }}</label
              >
              <textarea
                v-model="userDetails.address1"
                required
                rows="2"
                :placeholder="$t('checkout.form.address')"
              />
            </div>
            <div class="col-span-full">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                >{{ $t('checkout.form.address2') }}</label
              >
              <input
                v-model="userDetails.address2"
                type="text"
                :placeholder="$t('checkout.form.address2')"
              />
            </div>
            <div class="col-span-1">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                >{{ $t('checkout.form.state') }}</label
              >
              <input
                v-model="userDetails.state"
                type="text"
                :placeholder="$t('checkout.form.state')"
              />
            </div>
            <div class="col-span-1">
              <label
                class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                >{{ $t('checkout.form.postcode') }}</label
              >
              <input
                v-model="userDetails.postcode"
                type="text"
                :placeholder="$t('checkout.form.postcode')"
              />
            </div>
          </div>
          <p v-if="isNewCheckout" class="mt-3 text-xs text-neutral-500">
            {{ $t('checkout.payment_slip.method_label') }}:
            <span class="font-semibold text-black dark:text-white">{{
              $t('checkout.payment_method.bank_transfer')
            }}</span>
          </p>
          <p v-else class="mt-3 text-xs text-neutral-500">
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
            <label class="block text-sm font-medium text-black dark:text-white mb-1">
              {{ $t('checkout.payment_slip.bbl_bank_label') }}
            </label>
            <select
              v-model="selectedBank"
              required
              class="block w-full rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-black/30 px-4 py-3 text-black dark:text-white text-sm shadow font-semibold transition hover:border-black/40 dark:hover:border-white/30 focus-visible:outline-none focus-visible:border-black focus-visible:dark:border-white"
            >
              <option disabled value="">
                {{ $t('checkout.payment_slip.bbl_bank_placeholder') }}
              </option>
              <option v-for="code in TRANSFER_BANK_CODES" :key="code" :value="code">
                {{ $t(`checkout.payment_slip.bank_options.${code}`) }}
              </option>
            </select>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {{ $t('checkout.payment_slip.bbl_bank_hint') }}
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
            <div
              v-if="slipPreviewUrl && slipIsImage"
              class="mt-3 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-black/30 p-3 overflow-hidden"
            >
              <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                {{ $t('checkout.payment_slip.file_preview_label') }}
              </p>
              <img
                :src="slipPreviewUrl"
                :alt="$t('checkout.payment_slip.file_preview_alt')"
                class="max-h-72 w-full object-contain object-top rounded-xl mx-auto"
              />
            </div>
            <div
              v-else-if="slipFile && slipIsPdf"
              class="mt-3 flex items-center gap-3 rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-black/30 p-4"
            >
              <UIcon
                name="i-heroicons-document-text"
                class="w-10 h-10 shrink-0 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
              />
              <div class="min-w-0">
                <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {{ $t('checkout.payment_slip.file_pdf_selected') }}
                </p>
                <p class="text-sm text-black dark:text-white truncate font-medium">
                  {{ slipFile.name }}
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            :disabled="
              submitting ||
              (showBuyerForm && isLoadingCustomerData) ||
              bblSubmitBlocked
            "
            class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <span v-if="!submitting && !bblSubmitBlocked">{{ submitLabel }}</span>
            <span
              v-else-if="!submitting && bblSubmitBlocked"
              class="block text-center text-sm"
            >
              {{
                $t('checkout.payment_slip.bbl_submit_wait', {
                  time: bblCountdownFormatted,
                })
              }}
            </span>
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
    </div>

    <UModal
      v-model="bblModalOpen"
      :ui="{
        overlay: {
          background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
        },
        width: 'w-full sm:max-w-md',
      }"
    >
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-black dark:text-white pr-2">
            {{ $t('checkout.payment_slip.bbl_modal_title') }}
          </h3>
          <button
            type="button"
            class="p-2 shrink-0 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition"
            @click="bblModalOpen = false"
          >
            <UIcon
              name="i-heroicons-x-mark"
              class="w-5 h-5 text-neutral-500 dark:text-neutral-400"
            />
          </button>
        </div>
        <div class="mb-5 text-center">
          <UIcon
            name="i-heroicons-clock"
            class="w-14 h-14 mx-auto text-amber-500 mb-3"
          />
          <p
            class="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4 text-left"
          >
            {{ $t('checkout.payment_slip.bbl_modal_body') }}
          </p>
          <p
            class="text-3xl font-mono font-bold text-alizarin-crimson-600 dark:text-alizarin-crimson-400 tracking-tight"
          >
            {{ bblCountdownFormatted }}
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {{ $t('checkout.payment_slip.bbl_countdown_label') }}
          </p>
        </div>
        <button
          type="button"
          class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition"
          @click="bblModalOpen = false"
        >
          {{ $t('checkout.payment_slip.bbl_understood') }}
        </button>
      </div>
    </UModal>
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

textarea {
  resize: none;
}
</style>
