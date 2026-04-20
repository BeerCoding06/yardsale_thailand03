<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** ข้อความเต็มใน tooltip */
    tip: string;
    /** คลาสความกว้างสูงสุด + truncate (เช่น max-w-[200px]) */
    wrapClass?: string;
    /** คลาสเพิ่มบนตัวครอบที่โฟกัสได้ */
    innerClass?: string;
  }>(),
  { wrapClass: "max-w-[200px]", innerClass: "text-xs" }
);

const tipTrim = computed(() => String(props.tip ?? "").trim());
const showTip = computed(() => tipTrim.value.length > 0);
</script>

<template>
  <UTooltip
    v-if="showTip"
    :text="tipTrim"
    :open-delay="200"
    :popper="{ placement: 'top', strategy: 'fixed' }"
  >
    <span
      :class="[
        'inline-block max-w-full cursor-help truncate align-middle rounded outline-none',
        'focus-visible:ring-2 focus-visible:ring-neutral-400/60 dark:focus-visible:ring-neutral-500/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900',
        wrapClass,
        innerClass,
      ]"
      tabindex="0"
      role="button"
      :aria-label="tipTrim"
    >
      <slot />
    </span>
  </UTooltip>
  <span v-else :class="['inline-block max-w-full truncate text-neutral-500', wrapClass, innerClass]">
    <slot />
  </span>
</template>
