<script setup lang="ts">
import OAuthBrandIcon from "./OAuthBrandIcon.vue";

/**
 * ปุ่ม Google / Facebook / LINE — ไม่ใช้ UIcon/UButton กันคอมโพเนนต์ล้มแล้วหน้าว่าง
 * `inline=""` หรือไม่ส่ง prop → โหมดแถว
 */
const props = withDefaults(
  defineProps<{
    inline?: boolean | string;
    variant?: "inline" | "card";
  }>(),
  { variant: "inline" }
);

const { startGoogle, startFacebook, startLine } = useOAuthLogin();

const isRow = computed(() => {
  if (props.variant === "card") return false;
  const v = props.inline as unknown;
  if (v === false || v === "false" || v === 0) return false;
  if (v === true || v === "" || v === "true" || v == null) return true;
  return Boolean(v);
});
</script>

<template>
  <div
    v-if="isRow"
    class="flex flex-wrap items-center justify-center gap-2 sm:justify-end hidden opacity-[0]"
    role="group"
    aria-label="เข้าสู่ระบบด้วย Google Facebook LINE"
  >
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
      @click="startGoogle"
    >
      <svg width="24" height="24" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.64 1.22 9.12 3.6l6.8-6.8C35.92 2.48 30.4 0 24 0 14.62 0 6.46 5.8 2.96 14.22l7.9 6.14C12.82 14.3 17.97 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.1 24.55c0-1.65-.15-3.24-.42-4.77H24v9.03h12.4c-.53 2.85-2.14 5.26-4.57 6.88l7.1 5.52C43.96 37.27 46.1 31.45 46.1 24.55z"/>
        <path fill="#FBBC05" d="M10.86 28.36A14.5 14.5 0 019.5 24c0-1.52.26-2.98.72-4.36l-7.9-6.14A23.97 23.97 0 000 24c0 3.8.9 7.4 2.5 10.5l8.36-6.14z"/>
        <path fill="#34A853" d="M24 48c6.4 0 11.76-2.12 15.68-5.76l-7.1-5.52c-1.97 1.32-4.5 2.1-8.58 2.1-6.03 0-11.18-4.8-13.14-10.86l-8.36 6.14C6.46 42.2 14.62 48 24 48z"/>
      </svg>
      Google
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-transparent bg-[#1877F2] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166fe5]"
      @click="startFacebook"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 12a10 10 0 10-11.563 9.875v-6.99H7.898V12h2.539V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.885h-2.33v6.99A10.001 10.001 0 0022 12z"/>
      </svg>
      Facebook
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-transparent bg-[#06C755] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#05b34c]"
      @click="startLine"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 5.92 2 10.66C2 15.39 6.48 19.32 12 19.32C12.71 19.32 13.4 19.25 14.07 19.13L16.22 20.66L15.42 18.39C17.7 16.94 19.18 14.47 19.18 10.66C19.18 5.92 14.7 2 12 2ZM8.6 12.18H7.32V8.46H8.6V12.18ZM10.51 12.18H9.23V8.46H10.51V12.18ZM13.84 9.17H12.56V12.18H11.28V9.17H10V8.04H13.84V9.17ZM16.32 12.18H15.04V9.17H13.76V8.04H16.32V12.18Z" fill="#00B900"/>
      </svg>
      LINE
    </button>
  </div>

  <div
    v-else
    class="rounded-2xl border-2 border-neutral-200 bg-white/80 p-6 shadow-lg dark:border-neutral-800 dark:bg-black/20"
  >
    <p class="mb-4 text-center text-sm font-medium text-neutral-600 dark:text-neutral-300">
      เข้าสู่ระบบด้วยบัญชีโซเชียล
    </p>
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
      <button
        type="button"
        class="inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl border-2 border-neutral-300 bg-white px-4 py-3 font-semibold text-neutral-900 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 sm:flex-1"
        @click="startGoogle"
      >
        <OAuthBrandIcon provider="gmail" size-class="h-8 w-8" />
        Google
      </button>
      <button
        type="button"
        class="inline-flex min-h-[3rem] w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 font-semibold text-white hover:bg-[#166fe5]"
        @click="startFacebook"
      >
        <span class="text-white">
          <OAuthBrandIcon provider="facebook" size-class="h-8 w-8" />
        </span>
        Facebook
      </button>
      <button
        type="button"
        class="inline-flex min-h-[3rem] w-full flex-1 items-center justify-center gap-2 rounded-xl bg-[#06C755] px-4 py-3 font-semibold text-white hover:bg-[#05b34c]"
        @click="startLine"
      >
        <span class="text-white">
          <OAuthBrandIcon provider="line" size-class="h-8 w-8" />
        </span>
        LINE
      </button>
    </div>
  </div>
</template>
