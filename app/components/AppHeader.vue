<!--app/components/AppHeader.vue-->
<script setup>
const router = useRouter();
const route = useRoute();
const searchQuery = ref((route.query.q || "").toString());
const searchResults = ref([]);
const isLoading = ref(false);
const suggestionMenu = ref(false);
const onClickOutsideRef = ref(null);
const cartModal = ref(false);
const profileModal = ref(false);
const { cart } = useCart();
const { user, isAuthenticated, logout, checkAuth } = useAuth();
const localePath = useLocalePath();

// Client-side only state to prevent hydration mismatch
const isClient = ref(false);
const clientIsAuthenticated = ref(false);

// Check auth on mount to prevent hydration mismatch
onMounted(() => {
  isClient.value = true;
  if (import.meta.client) {
    checkAuth();
    // Update client auth state after check
    nextTick(() => {
      clientIsAuthenticated.value = isAuthenticated.value;
    });
  }
});

// Watch for auth changes
watch(
  isAuthenticated,
  (newVal, oldVal) => {
    if (isClient.value) {
      clientIsAuthenticated.value = newVal;
      // Close modals when user logs in (when transitioning from false to true)
      if (newVal && !oldVal) {
        // Close all modals immediately to ensure overlay disappears
        cartModal.value = false;
        profileModal.value = false;
        suggestionMenu.value = false;
      }
    }
  },
  { immediate: true }
);

// Watch for route changes to close modals
watch(
  () => route.path,
  () => {
    if (isClient.value) {
      // Close all modals when route changes
      cartModal.value = false;
      profileModal.value = false;
      suggestionMenu.value = false;
    }
  }
);

const search = () => {
  if (!searchQuery.value.trim()) {
    return;
  }
  router.push({
    path: localePath("/"),
    query: { ...route.query, q: searchQuery.value || undefined },
  });
  suggestionMenu.value = false;
};

async function fetch() {
  if (!import.meta.client) {
    return;
  }
  
  try {
    isLoading.value = true;
    const query = searchQuery.value?.trim() || '';
    
    if (!query) {
      // If no search query, show empty results or don't fetch
      searchResults.value = [];
      isLoading.value = false;
      return;
    }
    
    const response = await $fetch("/api/search", {
      query: { search: query },
    }).catch((err) => {
      console.error('[AppHeader] Search fetch error:', err);
      throw err;
    });
    
    // Handle different response formats
    if (response?.products?.nodes) {
      searchResults.value = response.products.nodes;
    } else if (Array.isArray(response?.products)) {
      searchResults.value = response.products;
    } else if (Array.isArray(response)) {
      searchResults.value = response;
    } else {
      console.warn('[AppHeader] Unexpected search response format:', response);
      searchResults.value = [];
    }
  } catch (error) {
    console.error('[AppHeader] Search error:', error);
    searchResults.value = [];
  } finally {
    isLoading.value = false;
  }
}

const throttledFetch = useDebounceFn(async () => {
  await fetch();
}, 300);

watch(
  () => searchQuery.value,
  (newVal, oldVal) => {
    if (import.meta.client && newVal !== oldVal) {
      // Only fetch if query has changed and is not empty
      if (newVal && newVal.trim()) {
        throttledFetch();
      } else {
        // Clear results if query is empty
        searchResults.value = [];
      }
    }
  }
);

// Watch route query changes to sync searchQuery
watch(
  () => route.query.q,
  (newQ) => {
    if (import.meta.client && newQ !== searchQuery.value) {
      searchQuery.value = (newQ || "").toString();
    }
  },
  { immediate: true }
);

const clearSearch = () => {
  suggestionMenu.value = false;
  searchQuery.value = "";
  router.push({ query: { ...route.query, q: undefined } });
};

onClickOutside(onClickOutsideRef, (event) => {
  suggestionMenu.value = false;
  cartModal.value = false;
  profileModal.value = false;
});

const totalQuantity = computed(() =>
  cart.value.reduce((s, i) => s + (i.quantity || 0), 0)
);
</script>

<template>
  <div>
    <div
      class="w-full py-[15px] items-center px-3 lg:px-5 z-40 fixed bg-white/85 dark:bg-black/85 backdrop-blur-sm dark:backdrop-blur-lg"
    >
      <div class="grid grid-cols-[1fr_max-content] items-center gap-[10px]">
        <div class="flex gap-[10px]">
          <NuxtLink
            aria-label="Home"
            class="flex items-center justify-center hover:bg-black/5 hover:dark:bg-white/15 max-lg:dark:bg-white/15 max-lg:bg-black/5 max-lg:hover:bg-black/10 max-lg:hover:dark:bg-white/20 rounded-2xl max-lg:rounded-full transition active:scale-95"
            :to="localePath('/')"
          >
            <img
              class="rounded-lg w-[50px] h-[50px]"
              src="/logo.png"
              alt="Logo"
              loading="lazy"
              title="logo"
            />
          </NuxtLink>
          <NuxtLink
            aria-label="Categories"
            exactActiveClass="bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white"
            class="font-semibold cursor-pointer px-4 rounded-full hover:bg-alizarin-crimson-600 hover:dark:bg-alizarin-crimson-500 h-12 items-center justify-center hover:text-white transition active:scale-95 lg:flex hidden"
            :to="localePath('/categories')"
          >
            {{ $t("nav.categories") }}
          </NuxtLink>
          <NuxtLink
            aria-label="Favorites"
            exactActiveClass="bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white"
            class="font-semibold cursor-pointer px-4 rounded-full hover:bg-alizarin-crimson-600 hover:dark:bg-alizarin-crimson-500 h-12 items-center justify-center hover:text-white transition active:scale-95 lg:flex hidden"
            :to="localePath('/favorites')"
          >
            {{ $t("nav.favorites") }}
          </NuxtLink>
          <!-- <NuxtLink
          aria-label="Categories"
          exactActiveClass="!bg-black/10 dark:!bg-white/30"
          class="lg:hidden flex items-center justify-center min-w-12 min-h-12 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 hover:dark:bg-white/20 transition active:scale-95"
          :to="localePath('/categories')">
          <UIcon class="text-[#5f5f5f] dark:text-[#b7b7b7]" name="i-iconamoon-category-fill" size="26" />
        </NuxtLink> -->
          <!-- <NuxtLink
          aria-label="Favorites"
          exactActiveClass="!bg-black/10 dark:!bg-white/30"
          class="lg:hidden flex items-center justify-center min-w-12 min-h-12 rounded-full bg-black/5 dark:bg-white/15 hover:bg-black/10 hover:dark:bg-white/20 transition active:scale-95"
          :to="localePath('/favorites')">
          <UIcon class="text-[#5f5f5f] dark:text-[#b7b7b7]" name="i-iconamoon-heart-fill" size="26" />
        </NuxtLink> -->
        </div>
        <div class="flex gap-[10px]">
          <div
            class="flex flex-shrink max-w-[190px] lg:max-w-[500px] flex-grow flex-col text-sm font-semibold text-[#111] dark:text-[#eee]"
          >
            <div
              :class="[
                'flex h-12 flex-grow rounded-full  pl-4 pr-3 transition-all hover:bg-black/10 hover:dark:bg-white/20',
                suggestionMenu
                  ? 'bg-black/10 dark:bg-white/20'
                  : 'bg-black/5 dark:bg-white/15',
              ]"
            >
              <div
                class="flex w-full items-center gap-4"
              >
                <div
                  v-if="!suggestionMenu"
                  class="flex text-neutral-500 dark:text-neutral-400"
                >
                  <UIcon name="i-iconamoon-search-bold" size="20" />
                </div>
                <div class="flex w-full">
                  <input
                    class="w-full bg-transparent py-2 outline-none placeholder:text-[#757575] placeholder:dark:text-neutral-400"
                    type="text"
                    v-model="searchQuery"
                    @keyup.enter="search"
                    @focus="suggestionMenu = true; if (searchQuery && searchQuery.trim()) fetch()"
                    @input="suggestionMenu = true"
                    :placeholder="
                      route.query.category
                        ? $t('search.placeholder_in_category', {
                            category: route.query.category,
                          })
                        : $t('search.placeholder')
                    "
                  />
                  <div
                    v-if="searchQuery || suggestionMenu"
                    @click.stop="clearSearch"
                    class="flex items-center justify-center cursor-pointer transition-all"
                  >
                    <UIcon
                      v-if="!isLoading"
                      class="text-black dark:text-white"
                      name="i-iconamoon-close-circle-1-fill"
                      size="24"
                    />
                    <UIcon
                      v-else
                      name="i-svg-spinners-bars-rotate-fade"
                      size="20"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            @mouseup="cartModal = !cartModal"
            class="hover:bg-black/5 hover:dark:bg-white/15 max-lg:dark:bg-white/15 max-lg:bg-black/5 max-lg:hover:bg-black/10 max-lg:hover:dark:bg-white/20 min-w-12 min-h-12 flex items-center justify-center rounded-full cursor-pointer relative"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              class="text-[#5f5f5f] dark:text-[#b7b7b7] w-[26px]"
              fill="currentColor"
            >
              <path
                d="M2.25 2.25a.75.75 0 0 0 0 1.5h1.386c.17 0 .318.114.362.278l2.558 9.592a3.752 3.752 0 0 0-2.806 3.63c0 .414.336.75.75.75h15.75a.75.75 0 0 0 0-1.5H5.378A2.25 2.25 0 0 1 7.5 15h11.218a.75.75 0 0 0 .674-.421 60.358 60.358 0 0 0 2.96-7.228.75.75 0 0 0-.525-.965A60.864 60.864 0 0 0 5.68 4.509l-.232-.867A1.875 1.875 0 0 0 3.636 2.25H2.25ZM3.75 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM16.5 20.25a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
              />
            </svg>
            <span
              v-if="totalQuantity"
              class="absolute top-1 right-1 flex h-[18px] w-[18px]"
            >
              <span
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-alizarin-crimson-400 opacity-75"
              ></span>
              <span
                class="relative inline-flex rounded-full h-[18px] w-[18px] bg-alizarin-crimson-700 text-[10px] items-center justify-center shadow font-semibold text-white"
              >
                {{ totalQuantity }}
              </span>
            </span>
          </button>

          <!-- Profile/Login Button (ClientOnly to prevent hydration mismatch) -->
          <ClientOnly>
            <!-- Profile Button -->
            <button
              v-if="clientIsAuthenticated"
              @mouseup="profileModal = !profileModal"
              class="hover:bg-black/5 hover:dark:bg-white/15 max-lg:dark:bg-white/15 max-lg:bg-black/5 max-lg:hover:bg-black/10 max-lg:hover:dark:bg-white/20 min-w-12 min-h-12 flex items-center justify-center rounded-full cursor-pointer relative overflow-hidden"
            >
              <img
                v-if="user && user.profile_picture_url"
                :src="user.profile_picture_url"
                :alt="user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name || user.display_name || 'Profile'"
                class="w-[26px] h-[26px] rounded-full object-cover"
              />
              <UIcon
                v-else
                name="i-heroicons-user-circle"
                class="text-[#5f5f5f] dark:text-[#b7b7b7] w-[26px] h-[26px]"
              />
            </button>

            <!-- Login Button -->
            <NuxtLink
              v-else
              :to="localePath('/login')"
              class="hover:bg-black/5 hover:dark:bg-white/15 max-lg:dark:bg-white/15 max-lg:bg-black/5 max-lg:hover:bg-black/10 max-lg:hover:dark:bg-white/20 min-w-12 min-h-12 flex items-center justify-center rounded-full cursor-pointer font-semibold px-4 text-sm"
            >
              {{ $t("auth.login") }}
            </NuxtLink>
            <template #fallback>
              <div class="min-w-12 min-h-12"></div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </div>
    <div
      v-if="suggestionMenu"
      ref="onClickOutsideRef"
      class="fixed top-[72px] lg:top-20 left-0 right-0 z-50 bg-white/85 dark:bg-black/85 backdrop-blur-sm dark:backdrop-blur-lg lg:rounded-b-3xl w-full"
      @click.stop
    >
      <div
        class="max-h-[calc(100vh-72px)] lg:max-h-[calc(100vh-80px)] overflow-auto"
      >
        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center h-80">
          <div
            class="bg-black/10 dark:bg-white/20 flex rounded-full w-12 h-12 items-center justify-center skeleton"
          >
            <UIcon
              class="text-white dark:text-black"
              name="i-svg-spinners-8-dots-rotate"
              size="26"
            />
          </div>
        </div>
        <!-- Empty State -->
        <div
          v-else-if="!searchResults.length"
          class="w-full items-center flex flex-col justify-center text-center p-8"
        >
          <div
            class="w-28 h-28 bg-black/10 dark:bg-white/20 rounded-full items-center justify-center flex"
          >
            <UIcon
              name="i-iconamoon-search-bold"
              class="w-16 h-16 dark:text-white"
            />
          </div>
          <div class="font-semibold text-3xl my-6">
            {{ $t("search.no_results_for_query") }}
            <strong>{{ searchQuery }}</strong>
          </div>
          <div class="text-sm text-center mb-5 max-w-md">
            {{ $t("search.no_results_suggestion") }}
          </div>
        </div>
        <!-- Results State-->
        <div v-else class="mx-auto p-3 lg:p-4 max-w-screen-2xl">
          <h2 v-if="!searchQuery" class="text-2xl font-bold tracking-tight">
            {{ $t("search.new_products") }}
          </h2>
          <div
            class="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-5 mt-3 lg:mt-5"
          >
            <NuxtLink
              @click="suggestionMenu = false"
              :to="
                localePath(
                  `/product/${product.slug}-${(product.sku || '').split('-')[0] || product.slug}`
                )
              "
              v-for="(product, i) in searchResults"
              :key="`${product.sku || product.slug || i}-${i}`"
              class="group select-none"
            >
              <div class="cursor-pointer transition ease-[ease] duration-300">
                <div
                  class="relative pb-[133%] dark:shadow-[0_8px_24px_rgba(0,0,0,.5)] rounded-2xl overflow-hidden"
                >
                  <NuxtImg
                    v-if="product.galleryImages?.nodes?.[0]?.sourceUrl"
                    :alt="product.name"
                    loading="lazy"
                    :title="product.name"
                    :src="product.galleryImages.nodes[0].sourceUrl"
                    class="absolute h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover"
                  />
                  <NuxtImg
                    v-if="product.image?.sourceUrl"
                    :alt="product.name"
                    loading="lazy"
                    :title="product.name"
                    :src="product.image.sourceUrl"
                    class="absolute h-full w-full dark:bg-neutral-800 bg-neutral-200 object-cover transition-opacity duration-300 group-hover:opacity-0"
                  />
                  <div
                    v-if="!product.image?.sourceUrl && !product.galleryImages?.nodes?.[0]?.sourceUrl"
                    class="absolute h-full w-full dark:bg-neutral-800 bg-neutral-200 flex items-center justify-center"
                  >
                    <UIcon name="i-iconamoon-image" class="w-16 h-16 text-neutral-400" />
                  </div>
                </div>
                <div
                  class="grid gap-0.5 pt-3 pb-4 px-1.5 text-sm font-semibold"
                >
                  <ProductPrice
                    :sale-price="product.salePrice"
                    :regular-price="product.regularPrice"
                    variant="card"
                  />
                  <div>{{ product.name }}</div>
                  <div v-if="product.allPaStyle?.nodes?.[0]?.name" class="font-normal text-[#5f5f5f] dark:text-[#a3a3a3]">
                    {{ product.allPaStyle.nodes[0].name }}
                  </div>
                </div>
              </div>
            </NuxtLink>
          </div>
        </div>
        <div
          v-if="searchQuery && !isLoading && searchResults.length"
          class="flex items-center justify-center border-t border-black/10 dark:border-white/20 p-4"
        >
          <button
            @click="search"
            class="bg-black/15 dark:bg-white/15 hover:bg-black/10 hover:dark:bg-white/20 px-4 py-2 rounded-full active:scale-95 tracking-wide text-sm transition"
          >
            {{ $t("search.view_all_results") }}
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="suggestionMenu || cartModal || profileModal"
      :class="['fixed inset-0 ', cartModal || profileModal ? 'z-40' : 'z-30']"
      @click="
        if (suggestionMenu) {
          suggestionMenu = false;
        }
        if (cartModal) {
          cartModal = false;
        }
        if (profileModal) {
          profileModal = false;
        }
      "
    >
      <div class="w-full h-full bg-black/30 backdrop-blur-lg"></div>
    </div>
    <button
      v-if="cartModal || profileModal"
      @click="
        cartModal = false;
        profileModal = false;
      "
      class="hover:bg-white/65 dark:hover:bg-white/10 transition shadow-2xl mt-3 lg:mt-4 mx-3 lg:mx-5 items-center justify-center min-w-12 min-h-12 rounded-[2rem] right-0 fixed flex z-50 bg-white/85 dark:bg-black/30 dark:border dark:border-white/10 cart-button-bezel backdrop-blur-lg"
    >
      <UIcon
        class="text-[#5f5f5f] dark:text-[#b7b7b7]"
        name="i-iconamoon-close"
        size="26"
      />
    </button>
    <Transition name="dropdown">
      <Cart v-if="cartModal" ref="onClickOutsideRef" />
    </Transition>
    <ClientOnly>
      <Transition name="dropdown">
        <div
          v-if="profileModal && clientIsAuthenticated"
          ref="onClickOutsideRef"
          class="fixed right-3 lg:right-5 top-[72px] lg:top-20 z-50 bg-white/85 dark:bg-black/85 backdrop-blur-sm dark:backdrop-blur-lg rounded-2xl shadow-2xl border-2 border-neutral-200 dark:border-neutral-800 min-w-[280px] max-w-[320px] overflow-hidden"
        >
          <div class="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center gap-3">
              <div
                class="w-12 h-12 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center overflow-hidden"
              >
                <img
                  v-if="user && user.profile_picture_url"
                  :src="user.profile_picture_url"
                  :alt="user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.name || user.display_name || 'Profile'"
                  class="w-full h-full object-cover"
                />
                <UIcon
                  v-else
                  name="i-heroicons-user-circle"
                  class="w-8 h-8 text-black dark:text-white"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-black dark:text-white truncate">
                  {{
                    user && user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user && user.first_name
                      ? user.first_name
                      : user && user.last_name
                      ? user.last_name
                      : user &&
                        (user.name || user.display_name || user.username)
                      ? user.name || user.display_name || user.username
                      : $t("auth.user")
                  }}
                </p>
                <p
                  class="text-xs text-neutral-500 dark:text-neutral-400 truncate"
                >
                  {{ user && user.email ? user.email : "" }}
                </p>
              </div>
            </div>
          </div>
          <div class="p-2">
            <NuxtLink
              :to="localePath('/profile')"
              @click="profileModal = false"
              class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white"
            >
              <UIcon name="i-heroicons-user" class="w-5 h-5" />
              <span class="font-medium">{{ $t("auth.profile") }}</span>
            </NuxtLink>
            <NuxtLink
              :to="localePath('/create-product')"
              @click="profileModal = false"
              class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white"
            >
              <UIcon name="i-heroicons-plus-circle" class="w-5 h-5" />
              <span class="font-medium">{{ $t("auth.create_product") }}</span>
            </NuxtLink>
            <NuxtLink
              :to="localePath('/my-products')"
              @click="profileModal = false"
              class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white"
            >
              <UIcon name="i-heroicons-cube-transparent" class="w-5 h-5" />
              <span class="font-medium">{{ $t("auth.my_products") }}</span>
            </NuxtLink>
            <NuxtLink
              :to="localePath('/my-orders')"
              @click="profileModal = false"
              class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white"
            >
              <UIcon name="i-heroicons-shopping-bag" class="w-5 h-5" />
              <span class="font-medium">{{ $t("auth.my_orders") }}</span>
            </NuxtLink>
            <NuxtLink
              :to="localePath('/seller-orders')"
              @click="profileModal = false"
              class="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition text-black dark:text-white"
            >
              <UIcon name="i-heroicons-credit-card" class="w-5 h-5" />
              <span class="font-medium">{{ $t("auth.seller_orders") }}</span>
            </NuxtLink>
            <button
              @click="
                logout();
                profileModal = false;
              "
              class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition text-red-600 dark:text-red-400"
            >
              <UIcon
                name="i-heroicons-arrow-right-on-rectangle"
                class="w-5 h-5"
              />
              <span class="font-medium">{{ $t("auth.logout") }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </ClientOnly>
  </div>
</template>

<style lang="postcss">
::-webkit-scrollbar {
  @apply w-0 h-0 bg-transparent;
}
::-webkit-scrollbar-track {
  @apply bg-transparent;
}
::-webkit-scrollbar-thumb {
  @apply bg-black/15 dark:bg-white/15 rounded-full border-solid border-white dark:border-black;
  border-width: 5px;
}
</style>
