<script setup>
const props = defineProps({
  /** จาก buildShipmentTimelineSteps(order) */
  steps: {
    type: Array,
    required: true,
  },
});

const { locale } = useI18n();

function formatTs(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale.value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
</script>

<template>
  <div class="relative pl-1">
    <div
      v-for="(step, index) in steps"
      :key="step.key"
      class="relative flex gap-4 pb-8 last:pb-0"
    >
      <!-- vertical line -->
      <div
        v-if="index < steps.length - 1"
        class="absolute left-[1.125rem] top-10 bottom-0 w-0.5 -translate-x-1/2"
        :class="
          step.variant === 'done'
            ? 'bg-emerald-500/80'
            : 'bg-neutral-200 dark:bg-neutral-700'
        "
      />

      <!-- icon -->
      <div
        class="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-shadow"
        :class="{
          'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25':
            step.variant === 'done',
          'border-alizarin-crimson-500 bg-alizarin-crimson-500 text-white ring-4 ring-alizarin-crimson-500/25':
            step.variant === 'active',
          'border-neutral-200 bg-white text-neutral-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-500':
            step.variant === 'pending',
        }"
      >
        <UIcon :name="step.icon" class="h-4 w-4" />
      </div>

      <div class="min-w-0 flex-1 pt-0.5">
        <p
          class="text-sm font-semibold leading-tight"
          :class="{
            'text-emerald-800 dark:text-emerald-200': step.variant === 'done',
            'text-alizarin-crimson-700 dark:text-alizarin-crimson-300':
              step.variant === 'active',
            'text-neutral-400 dark:text-neutral-500': step.variant === 'pending',
          }"
        >
          {{ $t(`order.shipment_timeline.${step.key}`) }}
        </p>
        <p
          v-if="step.timestampIso && (step.variant === 'done' || step.variant === 'active')"
          class="mt-1 text-xs text-neutral-500 dark:text-neutral-400"
        >
          {{ formatTs(step.timestampIso) }}
        </p>
      </div>
    </div>
  </div>
</template>
