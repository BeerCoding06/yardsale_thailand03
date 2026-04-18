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
    class="flex flex-wrap items-center justify-center gap-2 sm:justify-end"
    role="group"
    aria-label="เข้าสู่ระบบด้วย Google Facebook LINE"
  >
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
      @click="startGoogle"
    >
      <OAuthBrandIcon provider="gmail" size-class="h-6 w-6" />
      Google
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-transparent bg-[#1877F2] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166fe5]"
      @click="startFacebook"
    >
      <span class="text-white">
        <OAuthBrandIcon provider="facebook" size-class="h-6 w-6" />
      </span>
      Facebook
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-transparent bg-[#06C755] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#05b34c]"
      @click="startLine"
    >
      <span class="text-white">
        <OAuthBrandIcon provider="line" size-class="h-6 w-6" />
      </span>
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
