<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** true = ปุ่มเล็กเรียงแนวนอน วางข้างปุ่มเข้าสู่ระบบ */
    inline?: boolean;
  }>(),
  { inline: false }
);

const { startGoogle, startFacebook, startLine } = useOAuthLogin();
</script>

<template>
  <!-- แบบ inline: แถวเดียวกับปุ่มเข้าสู่ระบบ -->
  <div
    v-if="props.inline"
    class="flex flex-wrap items-center justify-end gap-2"
    role="group"
    aria-label="เข้าสู่ระบบด้วยโซเชียล"
  >
    <UButton
      type="button"
      color="white"
      variant="solid"
      size="md"
      class="shrink-0 ring-1 ring-neutral-200 dark:ring-neutral-600 px-3"
      @click="startGoogle"
    >
      <span class="flex items-center gap-1.5">
        <span
          class="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-[#4285F4] bg-white ring-1 ring-neutral-200"
          aria-hidden="true"
          >G</span
        >
        <span class="text-xs sm:text-sm font-semibold">Google</span>
      </span>
    </UButton>
    <UButton
      type="button"
      color="blue"
      variant="solid"
      size="md"
      class="shrink-0 px-3"
      @click="startFacebook"
    >
      <span class="flex items-center gap-1.5">
        <UIcon name="i-heroicons-user-group-20-solid" class="h-5 w-5" />
        <span class="text-xs sm:text-sm font-semibold">Facebook</span>
      </span>
    </UButton>
    <UButton
      type="button"
      color="green"
      variant="solid"
      size="md"
      class="shrink-0 px-3"
      @click="startLine"
    >
      <span class="flex items-center gap-1.5">
        <UIcon name="i-heroicons-chat-bubble-left-right-20-solid" class="h-5 w-5" />
        <span class="text-xs sm:text-sm font-semibold">LINE</span>
      </span>
    </UButton>
  </div>

  <!-- แบบการ์ด (หน้าอื่นที่ต้องการใช้แยก) -->
  <div
    v-else
    class="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20 p-6 shadow-lg"
  >
    <p
      class="text-center text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-4"
    >
      เข้าสู่ระบบด้วยบัญชีโซเชียล
    </p>
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-center sm:flex-wrap">
      <UButton
        type="button"
        color="white"
        variant="solid"
        size="lg"
        class="ring-1 ring-neutral-200 dark:ring-neutral-600 justify-center min-h-[3rem] font-semibold"
        block
        @click="startGoogle"
      >
        <span class="flex items-center justify-center gap-2 w-full">
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-[#4285F4] ring-1 ring-neutral-200"
            aria-hidden="true"
            >G</span
          >
          <span>Google</span>
        </span>
      </UButton>
      <UButton
        type="button"
        color="blue"
        variant="solid"
        size="lg"
        class="justify-center min-h-[3rem] font-semibold"
        block
        @click="startFacebook"
      >
        <span class="flex items-center justify-center gap-2 w-full">
          <UIcon
            name="i-heroicons-user-group-20-solid"
            class="h-6 w-6 shrink-0 opacity-90"
          />
          <span>Facebook</span>
        </span>
      </UButton>
      <UButton
        type="button"
        color="green"
        variant="solid"
        size="lg"
        class="justify-center min-h-[3rem] font-semibold"
        block
        @click="startLine"
      >
        <span class="flex items-center justify-center gap-2 w-full">
          <UIcon
            name="i-heroicons-chat-bubble-left-right-20-solid"
            class="h-6 w-6 shrink-0 opacity-90"
          />
          <span>LINE</span>
        </span>
      </UButton>
    </div>
  </div>
</template>
