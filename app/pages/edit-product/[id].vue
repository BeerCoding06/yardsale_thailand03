<!--app/pages/edit-product/[id].vue-->
<script setup>
// Page for editing products - requires authentication
definePageMeta({
  middleware: "auth",
  ssr: false, // Disable SSR to prevent hydration mismatches
});

const route = useRoute();
const { isAuthenticated, user, checkAuth } = useAuth();
const router = useRouter();

// Client-side only state
const isClient = ref(false);
const isChecking = ref(true);
const isLoadingProduct = ref(true);
const product = ref(null);
const error = ref(null);

const productId = computed(() => route.params.id);

// Fetch product data
const fetchProduct = async () => {
  if (!productId.value) {
    error.value = "Product ID is required";
    isLoadingProduct.value = false;
    return;
  }

  try {
    isLoadingProduct.value = true;
    error.value = null;

    // Fetch product via server API endpoint (which has access to WP_BASIC_AUTH)
    const productData = await $fetch(`/api/wp-post?id=${productId.value}`);

    // Verify ownership
    // Check via meta_data first
    let postAuthor = null;
    if (productData.meta_data) {
      const postAuthorMeta = productData.meta_data.find(
        (meta) => meta.key === "_post_author" || meta.key === "post_author"
      );
      postAuthor = postAuthorMeta ? parseInt(postAuthorMeta.value) : null;
    }

    // Also check via WordPress REST API if available
    if (productData.author) {
      const authorId = parseInt(productData.author);
      if (authorId && authorId !== user.value?.id) {
        throw new Error(t('my_products.no_permission_edit'));
      }
    } else if (postAuthor && postAuthor !== user.value?.id) {
      throw new Error(t('my_products.no_permission_edit'));
    }

    product.value = productData;
  } catch (err) {
    console.error("[edit-product] Error fetching product:", err);
    if (err?.statusCode === 404 || err?.data?.statusCode === 404) {
      error.value = t('my_products.product_not_found');
    } else if (err?.data?.message) {
      error.value = err.data.message;
    } else {
      error.value = err?.message || t('my_products.load_error');
    }
  } finally {
    isLoadingProduct.value = false;
  }
};

// Redirect to login if not authenticated (client-side only)
onMounted(async () => {
  isClient.value = true;

  // Wait for auth state to initialize from localStorage
  checkAuth();
  await nextTick();

  // Check authentication
  if (!isAuthenticated.value || !user.value) {
    navigateTo("/login");
    return;
  }

  isChecking.value = false;

  // Fetch product data
  await fetchProduct();
});

// Watch for auth changes
watch(isAuthenticated, (newVal) => {
  if (isClient.value && !newVal) {
    navigateTo("/login");
  }
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>
      <template v-if="isChecking || isLoadingProduct">
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">
              <span v-if="isChecking">{{ $t('auth.checking_auth') }}</span>
              <span v-else>{{ $t('my_products.loading_product') }}</span>
            </p>
          </div>
        </div>
      </template>
      <template v-else-if="error">
        <div class="max-w-4xl mx-auto p-6">
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center"
          >
            <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
            <NuxtLink
              to="/my-products"
              class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
            >
              {{ $t('my_products.back_to_my_products') }}
            </NuxtLink>
          </div>
        </div>
      </template>
      <template v-else-if="isAuthenticated && user && product">
        <UserFormEditProducts :product="product" :product-id="productId" />
      </template>
      <template v-else>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400 mb-4">
              {{ $t('my_products.login_required_edit') }}
            </p>
            <NuxtLink
              to="/login"
              class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
            >
              {{ $t('auth.login') }}
            </NuxtLink>
          </div>
        </div>
      </template>
      <template #fallback>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
              <p class="text-neutral-500 dark:text-neutral-400">{{ $t('general.loading') }}</p>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
