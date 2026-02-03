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
  (cart.value || []).reduce((s, i) => s + (i.quantity || 0), 0)
);

const cartTotal = computed(() => {
  if (!cart.value || cart.value.length === 0) {
    return '0.00';
  }
  
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

const isCartEmpty = computed(() => !cart.value || cart.value.length === 0);

// Watch cart changes for debugging
watch(() => cart.value, (newCart) => {
  console.log('[Checkout] Cart changed:', newCart?.length || 0, 'items');
  console.log('[Checkout] Cart total:', cartTotal.value);
  console.log('[Checkout] Total quantity:', totalQuantity.value);
}, { deep: true });

// Watch cartTotal and totalQuantity for debugging
watch([cartTotal, totalQuantity], ([newTotal, newQty]) => {
  console.log('[Checkout] Total updated:', newTotal, 'Quantity:', newQty);
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

      <!-- Show empty cart message if cart is empty -->
      <template v-else-if="isCartEmpty">
        <div class="flex flex-col items-center justify-center p-6 text-center">
          <UIcon
            name="i-iconamoon-shopping-cart-1"
            class="w-12 h-12 mb-4 text-neutral-400 dark:text-neutral-600"
          />
          <p class="text-lg font-semibold text-black dark:text-white mb-2">
            {{ $t('checkout.empty_cart.title') || 'ตะกร้าสินค้าว่างเปล่า' }}
          </p>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
            {{ $t('checkout.empty_cart.message') || 'กรุณาเพิ่มสินค้าในตะกร้าก่อนทำการสั่งซื้อ' }}
          </p>
          <NuxtLink
            to="/"
            class="px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
          >
            {{ $t('checkout.empty_cart.button') || 'เลือกสินค้า' }}
          </NuxtLink>
        </div>
      </template>

      <!-- Show checkout form if authenticated and cart has items -->
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

        <!-- Cart Items Summary -->
        <div class="w-full mb-4">
          <div class="text-sm font-semibold mb-3 text-black dark:text-white flex items-center justify-between">
            <span>{{ $t('checkout.items_summary') || 'รายการสินค้า' }}</span>
            <span class="text-xs font-normal text-neutral-600 dark:text-neutral-400">
              {{ totalQuantity }} {{ $t('checkout.items') || 'รายการ' }}
            </span>
          </div>
          <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <div
              v-for="item in cart.value"
              :key="item.key"
              class="flex items-start gap-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-black/5 dark:border-white/5"
            >
              <NuxtImg
                :src="(item.variation?.node?.image?.sourceUrl || item.product?.node?.image?.sourceUrl) || ''"
                class="w-16 h-16 object-cover rounded-lg flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-black dark:text-white mb-1 line-clamp-2">
                  {{ item.product?.node?.name || item.variation?.node?.name || 'Product' }}
                </p>
                <div class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                  <span>{{ $t('checkout.quantity') || 'จำนวน' }}: {{ item.quantity }}</span>
                  <span>•</span>
                  <span>
                    {{
                      (() => {
                        const node = item.variation?.node || item.product?.node || {};
                        const regularPrice = parseFloat(node.regularPrice) || 0;
                        const salePrice = parseFloat(node.salePrice) || 0;
                        const price = salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
                        return price.toFixed(2);
                      })()
                    }}฿/{{ $t('checkout.unit') || 'ชิ้น' }}
                  </span>
                </div>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-neutral-500 dark:text-neutral-500">
                    {{ $t('checkout.item_total') || 'รวม' }}:
                  </span>
                  <span class="text-sm font-bold text-black dark:text-white">
                    {{
                      (() => {
                        const node = item.variation?.node || item.product?.node || {};
                        const regularPrice = parseFloat(node.regularPrice) || 0;
                        const salePrice = parseFloat(node.salePrice) || 0;
                        const price = salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
                        return (price * (item.quantity || 1)).toFixed(2);
                      })()
                    }}฿
                  </span>
                </div>
              </div>
            </div>
          </div>
          <!-- Subtotal calculation -->
          <div class="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
            <div class="flex justify-between items-center text-sm">
              <span class="text-neutral-600 dark:text-neutral-400">
                {{ $t('checkout.subtotal_items') || 'ยอดรวมสินค้า' }} ({{ totalQuantity }} {{ $t('checkout.items') || 'รายการ' }}):
              </span>
              <span class="font-semibold text-black dark:text-white">
                {{ cartTotal }}฿
              </span>
            </div>
          </div>
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

        <!-- Order Summary -->
        <div class="w-full mb-4 p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-black/10 dark:border-white/10">
          <div class="text-sm font-semibold mb-3 text-black dark:text-white">
            {{ $t('checkout.order_summary') || 'สรุปคำสั่งซื้อ' }}
          </div>
          
          <div class="space-y-2 text-sm">
            <div class="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>{{ $t('checkout.subtotal') || 'ยอดรวมสินค้า' }}</span>
              <span>{{ cartTotal }}฿</span>
            </div>
            <div class="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>{{ $t('checkout.items_count') || 'จำนวนสินค้า' }}</span>
              <span>{{ totalQuantity }} {{ $t('checkout.items') || 'รายการ' }}</span>
            </div>
            <div class="border-t border-black/10 dark:border-white/10 pt-2 mt-2">
              <div class="flex justify-between text-base font-bold text-black dark:text-white">
                <span>{{ $t('checkout.total') || 'รวมทั้งสิ้น' }}</span>
                <span>{{ cartTotal }}฿</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="checkoutStatus !== 'order' || isCartEmpty"
          @click="() => {
            console.log('[Checkout] Button clicked');
            console.log('[Checkout] Cart:', cart.value);
            console.log('[Checkout] Cart total:', cartTotal);
            console.log('[Checkout] Total quantity:', totalQuantity);
            console.log('[Checkout] Checkout status:', checkoutStatus);
            console.log('[Checkout] Is cart empty:', isCartEmpty);
            console.log('[Checkout] Is authenticated:', isAuthenticated);
          }"
          class="pay-button-bezel w-full h-12 rounded-xl relative font-semibold text-white text-lg flex justify-center items-center bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Transition name="slide-up">
            <div v-if="checkoutStatus === 'order'" class="absolute">
              {{
                $t("checkout.pay.btn", {
                  total: cartTotal,
                }) || `ชำระเงิน ${cartTotal}฿`
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
