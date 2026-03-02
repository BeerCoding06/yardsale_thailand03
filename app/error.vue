<!-- app/error.vue - 404 and error page -->
<script setup lang="ts">
const props = defineProps<{
  error: { statusCode?: number; message?: string; statusMessage?: string }
}>();

const { site } = useAppConfig();
const is404 = computed(() => props.error?.statusCode === 404);
const title = computed(() =>
  is404.value ? 'ไม่พบหน้า (Page Not Found)' : 'เกิดข้อผิดพลาด (Error)'
);
const message = computed(() =>
  is404.value
    ? 'หน้าที่คุณต้องการไม่มีอยู่หรือย้ายไปแล้ว'
    : props.error?.message || props.error?.statusMessage || 'เกิดข้อผิดพลาด กรุณาลองใหม่ภายหลัง'
);

const clearErr = () => clearError({ redirect: '/' });
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center px-4">
    <div class="text-center max-w-md">
      <p class="text-6xl font-bold text-primary-500 mb-2">
        {{ error?.statusCode || 'Error' }}
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
          กลับหน้าหลัก
        </NuxtLink>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          @click="clearErr"
        >
          ลองอีกครั้ง
        </button>
      </div>
    </div>
  </div>
</template>
