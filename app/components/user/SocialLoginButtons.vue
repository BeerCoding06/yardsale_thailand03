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
      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24" height="24" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
      </svg>
      Google
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-transparent bg-[#1877F2] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#166fe5]"
      @click="startFacebook"
    >
      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24" height="24" viewBox="0 0 48 48">
      <path fill="#039be5" d="M24 5A19 19 0 1 0 24 43A19 19 0 1 0 24 5Z"></path><path fill="#fff" d="M26.572,29.036h4.917l0.772-4.995h-5.69v-2.73c0-2.075,0.678-3.915,2.619-3.915h3.119v-4.359c-0.548-0.074-1.707-0.236-3.897-0.236c-4.573,0-7.254,2.415-7.254,7.917v3.323h-4.701v4.995h4.701v13.729C22.089,42.905,23.032,43,24,43c0.875,0,1.729-0.08,2.572-0.194V29.036z"></path>
      </svg>
      Facebook
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-xl border-2 border-transparent bg-[#06C755] px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#05b34c]"
      @click="startLine"
    >
      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="24" height="24" viewBox="0 0 48 48">
      <path fill="#00c300" d="M12.5,42h23c3.59,0,6.5-2.91,6.5-6.5v-23C42,8.91,39.09,6,35.5,6h-23C8.91,6,6,8.91,6,12.5v23C6,39.09,8.91,42,12.5,42z"></path><path fill="#fff" d="M37.113,22.417c0-5.865-5.88-10.637-13.107-10.637s-13.108,4.772-13.108,10.637c0,5.258,4.663,9.662,10.962,10.495c0.427,0.092,1.008,0.282,1.155,0.646c0.132,0.331,0.086,0.85,0.042,1.185c0,0-0.153,0.925-0.187,1.122c-0.057,0.331-0.263,1.296,1.135,0.707c1.399-0.589,7.548-4.445,10.298-7.611h-0.001C36.203,26.879,37.113,24.764,37.113,22.417z M18.875,25.907h-2.604c-0.379,0-0.687-0.308-0.687-0.688V20.01c0-0.379,0.308-0.687,0.687-0.687c0.379,0,0.687,0.308,0.687,0.687v4.521h1.917c0.379,0,0.687,0.308,0.687,0.687C19.562,25.598,19.254,25.907,18.875,25.907z M21.568,25.219c0,0.379-0.308,0.688-0.687,0.688s-0.687-0.308-0.687-0.688V20.01c0-0.379,0.308-0.687,0.687-0.687s0.687,0.308,0.687,0.687V25.219z M27.838,25.219c0,0.297-0.188,0.559-0.47,0.652c-0.071,0.024-0.145,0.036-0.218,0.036c-0.215,0-0.42-0.103-0.549-0.275l-2.669-3.635v3.222c0,0.379-0.308,0.688-0.688,0.688c-0.379,0-0.688-0.308-0.688-0.688V20.01c0-0.296,0.189-0.558,0.47-0.652c0.071-0.024,0.144-0.035,0.218-0.035c0.214,0,0.42,0.103,0.549,0.275l2.67,3.635V20.01c0-0.379,0.309-0.687,0.688-0.687c0.379,0,0.687,0.308,0.687,0.687V25.219z M32.052,21.927c0.379,0,0.688,0.308,0.688,0.688c0,0.379-0.308,0.687-0.688,0.687h-1.917v1.23h1.917c0.379,0,0.688,0.308,0.688,0.687c0,0.379-0.309,0.688-0.688,0.688h-2.604c-0.378,0-0.687-0.308-0.687-0.688v-2.603c0-0.001,0-0.001,0-0.001c0,0,0-0.001,0-0.001v-2.601c0-0.001,0-0.001,0-0.002c0-0.379,0.308-0.687,0.687-0.687h2.604c0.379,0,0.688,0.308,0.688,0.687s-0.308,0.687-0.688,0.687h-1.917v1.23H32.052z"></path>
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
