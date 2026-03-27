<script setup>
import { push } from 'notivue';

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

const methodForOrder = computed(() => {
  const m = String(route.query.method || '').toLowerCase();
  if (m === 'cod') return 'cod';
  return 'bank_transfer';
});

const qrSrc = computed(() => {
  const u = String(config.public.promptpayQrImageUrl || '').trim();
  return u || '/images/promptpay-qr.png';
});

const bankTransferDisplay = computed(() => {
  const fromEnv = String(config.public.storeBankTransferInfo || '').trim();
  return fromEnv || t('checkout.payment_slip.bank_account_default');
});

const slipFile = ref(null);
const slipUrl = ref('');
const slipData = ref('');
const submitting = ref(false);

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
    return;
  }
  if (!cart.value?.length) {
    router.replace(localePath('/'));
    return;
  }
  paymentMethod.value = methodForOrder.value;
  await loadCustomerData();
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
      push.success(t('checkout.payment_slip.verify_success_toast'));
      await router.push(
        localePath({
          path: '/payment-successful',
          query: { order_id: orderId.value, slip_verified: '1' },
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

/** สั่งซื้อใหม่: สร้างออเดอร์ + (สลิปถ้าโอนเงิน) */
async function onSubmitNew() {
  error.value = null;
  if (!validateBuyerForm()) {
    error.value = t('checkout.error.incomplete_data');
    return;
  }

  const method = methodForOrder.value;

  if (method === 'bank_transfer') {
    const hasFile = !!slipFile.value;
    const hasUrl = !!String(slipUrl.value || '').trim();
    const hasData = !!String(slipData.value || '').trim();
    if (!hasFile && !hasUrl && !hasData) {
      error.value = t('checkout.payment_slip.errors.PAYMENT_PROOF_REQUIRED');
      return;
    }
  }

  submitting.value = true;
  try {
    const orderData = await createOrderFromCart(method);
    if (!orderData?.id) {
      return;
    }

    if (method === 'cod') {
      await router.push(
        localePath({
          path: '/payment-successful',
          query: { order_id: String(orderData.id) },
        })
      );
      return;
    }

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
      push.success(t('checkout.payment_slip.verify_success_toast'));
      await router.push(
        localePath({
          path: '/payment-successful',
          query: { order_id: String(orderData.id), slip_verified: '1' },
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

async function onSubmit() {
  if (isResumePay.value) {
    await onSubmitResumeOnly();
  } else {
    await onSubmitNew();
  }
}

const submitLabel = computed(() => {
  if (isResumePay.value) return t('checkout.payment_slip.upload_btn');
  if (methodForOrder.value === 'cod') return t('checkout.payment_slip.submit_place_order_cod');
  return t('checkout.payment_slip.submit_place_order_bank');
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
        <!-- ฟอร์มผู้สั่งซื้อ — สั่งใหม่จากตะกร้า หรือกลับมาอัปโหลดสลิป (อ่านอย่างเดียว) -->
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
          <div class="grid grid-cols-2 gap-3 billing" :class="{ 'billing-readonly': isResumePay }">
            <div class="col-span-full">
              <input
                v-model="userDetails.email"
                required
                type="email"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.email')"
              />
            </div>
            <div class="col-span-1">
              <input
                v-model="userDetails.firstName"
                required
                type="text"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.first_name')"
              />
            </div>
            <div class="col-span-1">
              <input
                v-model="userDetails.lastName"
                required
                type="text"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.last_name')"
              />
            </div>
            <div class="col-span-1">
              <input
                v-model="userDetails.phone"
                required
                type="tel"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.phone')"
              />
            </div>
            <div class="col-span-1">
              <input
                v-model="userDetails.city"
                required
                type="text"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.city')"
              />
            </div>
            <div class="col-span-full">
              <textarea
                v-model="userDetails.address1"
                required
                rows="2"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.address')"
              />
            </div>
            <div class="col-span-full">
              <input
                v-model="userDetails.address2"
                type="text"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.address2')"
              />
            </div>
            <div class="col-span-1">
              <input
                v-model="userDetails.state"
                type="text"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.state')"
              />
            </div>
            <div class="col-span-1">
              <input
                v-model="userDetails.postcode"
                type="text"
                :readonly="isResumePay"
                :placeholder="$t('checkout.form.postcode')"
              />
            </div>
          </div>
          <p v-if="isNewCheckout" class="mt-3 text-xs text-neutral-500">
            {{ $t('checkout.payment_slip.method_label') }}:
            <span class="font-semibold text-black dark:text-white">{{
              methodForOrder === 'cod'
                ? $t('checkout.payment_method.cod')
                : $t('checkout.payment_method.bank_transfer')
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
          v-if="isResumePay || methodForOrder === 'bank_transfer'"
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

        <!-- COD: ไม่มีสลิป -->
        <div
          v-if="isNewCheckout && methodForOrder === 'cod'"
          class="mb-6 p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-700 dark:text-neutral-300"
        >
          {{ $t('checkout.payment_slip.cod_hint') }}
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
                isNewCheckout && methodForOrder === 'cod'
                  ? $t('checkout.payment_slip.cart_total_preview')
                  : $t('checkout.payment_slip.amount_label')
              }}
            </label>
            <p class="text-lg font-semibold text-alizarin-crimson-600 dark:text-alizarin-crimson-400">
              ฿{{ displayAmount || '—' }}
            </p>
          </div>

          <template v-if="!isNewCheckout || methodForOrder === 'bank_transfer'">
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
          </template>

          <button
            type="submit"
            :disabled="submitting || (showBuyerForm && isLoadingCustomerData)"
            class="w-full py-3 rounded-xl font-semibold text-white bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <span v-if="!submitting">{{ submitLabel }}</span>
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

.billing-readonly input:read-only,
.billing-readonly textarea:read-only {
  @apply opacity-90 cursor-default bg-neutral-100/90 dark:bg-neutral-900/50 hover:border-transparent dark:hover:border-transparent;
}

textarea {
  resize: none;
}
</style>
