<!-- app/error.vue - 404 and error page -->
<script setup lang="ts">
const props = defineProps<{
  error: { statusCode?: number; message?: string; statusMessage?: string }
}>();

const { site } = useAppConfig();
const { t } = useI18n();

const is404 = computed(() => props.error?.statusCode === 404);
const title = computed(() =>
  is404.value ? t('errors.not_found_title') : t('errors.server_error_title')
);
const message = computed(() =>
  is404.value
    ? t('errors.not_found_description')
    : props.error?.message || props.error?.statusMessage || t('errors.default_message')
);

const clearErr = () => clearError({ redirect: '/' });
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center px-4">
    <div class="text-center max-w-md">
      <p class="text-6xl font-bold text-primary-500 mb-2">
        {{ error?.statusCode || t('errors.error_code') }}
      </p>
      <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {{ title }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        {{ message }}
      </p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <NuxtLink
          to="/"
          class="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 transition"
        >
          {{ t('errors.back_home') }}
        </NuxtLink>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          @click="clearErr"
        >
          {{ t('errors.retry') }}
        </button>
      </div>
    </div>
  </div>
</template>
