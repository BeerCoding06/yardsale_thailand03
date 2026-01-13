<!--app/components/Checkout.vue-->
<script setup>
const {
  userDetails,
  checkoutStatus,
  error,
  handleCheckout,
  loadCustomerData,
  isLoadingCustomerData,
} = useCheckout();
const { cart } = useCart();
const { isAuthenticated, checkAuth } = useAuth();
const router = useRouter();

// Client-side only state
const isClient = ref(false);

// Load customer data when component mounts and user is authenticated
onMounted(async () => {
  isClient.value = true;
  checkAuth();

  if (isAuthenticated.value) {
    await loadCustomerData();
  }
});

const totalQuantity = computed(() =>
  cart.value.reduce((s, i) => s + (i.quantity || 0), 0)
);

const cartTotal = computed(() => {
  const total = cart.value.reduce((accumulator, item) => {
    const node =
      item.variation && item.variation.node
        ? item.variation.node
        : item.product && item.product.node
        ? item.product.node
        : {};
    const regularPrice = parseFloat(node.regularPrice) || 0;
    const salePrice = parseFloat(node.salePrice) || 0;
    const priceToUse =
      salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
    return accumulator + priceToUse * (item.quantity || 1);
  }, 0);

  return total.toFixed(2);
});
</script>

<template>
  <div
    class="md:w-96 h-full bg-black/5 dark:bg-white/10 my-3 mr-3 p-3 max-md:ml-3 rounded-3xl"
  >
    <div class="text-xl font-bold px-2 mb-3">{{ $t('checkout.title') }}</div>

    <!-- Show login prompt if not authenticated -->
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

      <!-- Show loading state -->
      <template v-else-if="isLoadingCustomerData">
        <div class="flex flex-col items-center justify-center p-6">
          <UIcon
            name="i-svg-spinners-90-ring-with-bg"
            class="w-8 h-8 mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('checkout.loading_data') }}
          </p>
        </div>
      </template>

      <!-- Show checkout form if authenticated -->
      <form
        v-else
        @submit.prevent="handleCheckout"
        class="flex flex-col items-center justify-center"
      >
        <!-- Error Message -->
        <div
          v-if="error"
          class="w-full mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
        >
          <p class="text-red-600 dark:text-red-400 text-sm">{{ error }}</p>
        </div>

        <!-- Input form fields with data from profile -->
        <div class="grid grid-cols-2 gap-3 billing w-full">
          <div class="col-span-full">
            <input
              required
              v-model="userDetails.email"
              :placeholder="$t('checkout.form.email')"
              name="email"
              type="email"
              class=""
            />
          </div>
          <div class="col-span-1">
            <input
              required
              v-model="userDetails.firstName"
              :placeholder="$t('checkout.form.first_name')"
              name="first-name"
              type="text"
            />
          </div>
          <div class="col-span-1">
            <input
              required
              v-model="userDetails.lastName"
              :placeholder="$t('checkout.form.last_name')"
              name="last-name"
              type="text"
            />
          </div>
          <div class="col-span-1">
            <input
              required
              v-model="userDetails.phone"
              :placeholder="$t('checkout.form.phone')"
              name="phone"
              type="tel"
            />
          </div>
          <div class="col-span-1">
            <input
              required
              v-model="userDetails.city"
              :placeholder="$t('checkout.form.city')"
              name="city"
              type="text"
            />
          </div>
          <div class="col-span-full">
            <textarea
              required
              v-model="userDetails.address1"
              :placeholder="$t('checkout.form.address')"
              name="address"
              rows="2"
            ></textarea>
          </div>
          <div class="col-span-full">
            <input
              v-model="userDetails.address2"
              :placeholder="$t('checkout.form.address2')"
              name="address2"
              type="text"
            />
          </div>
          <div class="col-span-1">
            <input
              v-model="userDetails.state"
              :placeholder="$t('checkout.form.state')"
              name="state"
              type="text"
            />
          </div>
          <div class="col-span-1">
            <input
              v-model="userDetails.postcode"
              :placeholder="$t('checkout.form.postcode')"
              name="postcode"
              type="text"
            />
          </div>
        </div>
        <div
          class="text-sm font-semibold p-4 text-neutral-600 dark:text-neutral-400"
        >
          {{
            $t("checkout.pay.description", {
              total: cartTotal,
              items: totalQuantity,
            })
          }}
        </div>
        <button
          type="submit"
          :disabled="checkoutStatus !== 'order' && checkoutStatus !== 'success'"
          class="pay-button-bezel w-full h-12 rounded-xl relative font-semibold text-white text-lg flex justify-center items-center bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Transition name="slide-up">
            <div v-if="checkoutStatus === 'order'" class="absolute">
              {{
                $t("checkout.pay.btn", {
                  total: cartTotal,
                })
              }}
            </div>
            <div
              v-else-if="checkoutStatus === 'processing'"
              class="absolute flex items-center gap-2"
            >
              <UIcon name="i-svg-spinners-90-ring-with-bg" size="22" />
              <span>{{ $t('checkout.pay.processing') }}</span>
            </div>
            <div v-else-if="checkoutStatus === 'success'" class="absolute">
              {{ $t('checkout.pay.order_created_success') }}
            </div>
          </Transition>
        </button>
        <div
          class="text-xs font-medium p-4 flex gap-1 items-end text-neutral-400 dark:text-neutral-600"
        >
          <UIcon name="i-iconamoon-lock-fill" size="18" />
          <div>
            {{
              $t("checkout.pay.secure", {
                method: "Stripe",
              })
            }}
          </div>
        </div>
      </form>
      <template #fallback>
        <div class="flex flex-col items-center justify-center p-6">
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 250ms;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

textarea {
  resize: none;
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
