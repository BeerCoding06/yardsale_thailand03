<!--app/pages/create-product.vue-->
<script setup>
// Page for creating products - requires authentication
definePageMeta({
  middleware: "auth",
});

const { isAuthenticated, user, checkAuth } = useAuth();
const router = useRouter();

// Client-side only state to prevent hydration mismatch
const isClient = ref(false);
const isChecking = ref(true);

// Redirect to login if not authenticated (client-side only)
onMounted(async () => {
  isClient.value = true;

  // Wait for auth state to initialize from localStorage
  checkAuth();
  await nextTick();

  // Check authentication
  if (!isAuthenticated.value || !user.value) {
    const loginPath = "/login";
    if (loginPath && typeof loginPath === "string") {
      navigateTo(loginPath);
    }
    return;
  }

  isChecking.value = false;
  console.log(
    "[create-product] Page loaded, user authenticated:",
    user.value.id
  );
});

// Watch for auth changes
watch(isAuthenticated, (newVal) => {
  if (isClient.value && !newVal) {
    const loginPath = "/login";
    if (loginPath && typeof loginPath === "string") {
      navigateTo(loginPath);
    }
  }
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>
      <template v-if="isChecking">
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400">
              {{ $t('auth.checking_auth') }}
            </p>
          </div>
        </div>
      </template>
      <template v-else-if="isAuthenticated && user">
        <UserFormCreateProducts />
      </template>
      <template v-else>
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-center">
            <p class="text-neutral-500 dark:text-neutral-400 mb-4">
              {{ $t('my_products.login_required_create') }}
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
