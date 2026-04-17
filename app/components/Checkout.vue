<!--app/components/Checkout.vue-->
<script setup>
const {
  checkoutStatus,
  error,
  proceedToPaymentPage,
  isCartStockValid,
} = useCheckout();
const { cart, refreshCartStockFromServer } = useCart();
const { t } = useI18n();
const { isAuthenticated, checkAuth } = useAuth();

const reactiveCart = computed(() => {
  const cartValue = cart.value || [];
  return Array.isArray(cartValue) ? cartValue : [];
});

const isRefreshingStock = ref(false);
const isNavigating = ref(false);

onMounted(async () => {
  checkAuth();

  if (cart.value?.length) {
    isRefreshingStock.value = true;
    try {
      await refreshCartStockFromServer();
    } finally {
      isRefreshingStock.value = false;
    }
  }
});

const totalQuantity = computed(() =>
  reactiveCart.value.reduce((s, i) => s + (i.quantity || 0), 0)
);

const parsePrice = (priceString) => {
  if (!priceString) return 0;
  const cleaned = String(priceString).replace(/<[^>]*>/g, '').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

const cartTotal = computed(() => {
  if (!reactiveCart.value || reactiveCart.value.length === 0) {
    return '0.00';
  }
  const total = reactiveCart.value.reduce((accumulator, item) => {
    const node =
      item.variation && item.variation.node
        ? item.variation.node
        : item.product && item.product.node
          ? item.product.node
          : {};
    const regularPrice = parsePrice(node.regularPrice);
    const salePrice = parsePrice(node.salePrice);
    const priceToUse =
      salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
    return accumulator + priceToUse * (item.quantity || 1);
  }, 0);
  return total.toFixed(2);
});

const isCartEmpty = computed(() => !reactiveCart.value || reactiveCart.value.length === 0);
const hasStockForPayment = computed(() => isCartStockValid());

async function onContinueToPayment() {
  error.value = null;
  isNavigating.value = true;
  try {
    await proceedToPaymentPage();
  } finally {
    isNavigating.value = false;
  }
}
</script>

<template>
  <div
    class="md:w-96 h-full bg-black/5 dark:bg-white/10 my-3 mr-3 p-3 max-md:ml-3 rounded-3xl"
  >
    <div class="text-xl font-bold px-2 mb-3">{{ $t('checkout.title') }}</div>

    <ClientOnly>
      <template v-if="!isAuthenticated">
        <div class="flex flex-col items-center justify-center p-6 text-center">
          <UIcon
            name="i-heroicons-lock-closed"
            class="w-12 h-12 mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p class="text-lg font-semibold text-black dark:text-white mb-2">
            {{ $t('checkout.login_required.title') }}
          </p>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {{ $t('checkout.login_required.message') }}
          </p>
          <NuxtLink
            to="/login"
            class="px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
          >
            {{ $t('checkout.login_required.button') }}
          </NuxtLink>
        </div>
      </template>

      <template v-else-if="isCartEmpty">
        <div class="flex flex-col items-center justify-center p-6 text-center">
          <UIcon
            name="i-iconamoon-shopping-cart-1"
            class="w-12 h-12 mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p class="text-lg font-semibold text-black dark:text-white mb-2">
            {{ $t('checkout.empty_cart.title') }}
          </p>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {{ $t('checkout.empty_cart.message') }}
          </p>
          <NuxtLink
            to="/"
            class="px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
          >
            {{ $t('checkout.empty_cart.button') }}
          </NuxtLink>
        </div>
      </template>

      <form
        v-else
        @submit.prevent="onContinueToPayment"
        class="flex flex-col items-center justify-center"
      >
        <div
          v-if="error"
          class="w-full mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
        >
          <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
        </div>
        <div
          v-if="isRefreshingStock"
          class="w-full mb-3 text-center text-sm text-neutral-600 dark:text-neutral-400"
        >
          {{ t('checkout.refreshing_stock') }}
        </div>
        <div
          v-if="!isCartEmpty && !hasStockForPayment && !error"
          class="w-full mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
        >
          <p class="text-amber-700 dark:text-amber-300 text-sm">
            {{ $t('checkout.error.insufficient_stock') }}
          </p>
        </div>

        <p class="w-full text-xs text-neutral-500 dark:text-neutral-400 mb-3 px-1">
          {{ $t('checkout.pay.continue_hint') }}
        </p>

        <p class="w-full mb-4 text-sm text-neutral-600 dark:text-neutral-400 px-1">
          {{ $t('checkout.payment_method.bank_transfer') }}
        </p>

        <div
          :key="`checkout-summary-${cartTotal}-${totalQuantity}`"
          class="text-sm font-semibold p-4 text-neutral-600 dark:text-neutral-400"
        >
          {{
            $t('checkout.pay.description', {
              total: cartTotal,
              items: totalQuantity,
            })
          }}
        </div>
        <button
          type="submit"
          :disabled="
            checkoutStatus !== 'order' ||
            isCartEmpty ||
            !hasStockForPayment ||
            isRefreshingStock ||
            isNavigating
          "
          class="pay-button-bezel w-full h-12 leading-[50px] rounded-xl relative font-semibold text-white text-lg flex justify-center items-center bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="!isNavigating">{{ $t('checkout.pay.continue_to_payment') }}</span>
          <span v-else class="inline-flex items-center gap-2">
            <UIcon name="i-svg-spinners-90-ring-with-bg" size="22" />
            {{ $t('checkout.pay.processing') }}
          </span>
        </button>
        <div
          class="text-xs font-medium p-4 flex gap-1 items-end text-neutral-400 dark:text-neutral-600"
        >
          <UIcon name="i-iconamoon-lock-fill" size="18" />
          <div>{{ $t('checkout.pay.secure', { method: 'YardSale Checkout' }) }}</div>
        </div>
      </form>
      <template #fallback>
        <div class="flex flex-col items-center justify-center p-6 h-[500px] overflow-y-auto">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('general.loading') }}
          </p>
        </div>
      </template>
    </ClientOnly>
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

.pay-button-bezel {
  box-shadow: 0 0 0 var(--button-outline, 0px) rgba(252, 6, 42, 0.3),
    inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.3), 0 1px 1px 0 rgba(0, 0, 0, 0.3);
  @apply outline-none tracking-[-0.125px] transition scale-[var(--button-scale,1)] duration-200;

  &:hover:not(:disabled) {
    @apply brightness-110;
  }

  &:active:not(:disabled) {
    --button-outline: 4px;
    --button-scale: 0.975;
  }
}
</style>
