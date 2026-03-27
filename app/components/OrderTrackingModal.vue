<script setup>
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  order: { type: Object, default: null },
});

const emit = defineEmits(["update:modelValue"]);

const { t, locale } = useI18n();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const trackingNumber = computed(() => {
  const o = props.order;
  if (!o) return "";
  return String(o.tracking_number || o.trackingNumber || "").trim();
});

const courierName = computed(() => {
  const o = props.order;
  if (!o) return t("order.tracking_modal.courier_placeholder");
  return String(o.courier_name || o.courierName || "").trim() || t("order.tracking_modal.courier_placeholder");
});

const courierLogo = computed(() => {
  const o = props.order;
  const u = o?.courier_logo_url || o?.courierLogoUrl;
  return typeof u === "string" && u.trim() ? u.trim() : "";
});

const liveStatus = computed(() => {
  const o = props.order;
  if (!o) return t("order.tracking_modal.status_unknown");
  const s = String(o.shipping_status || o.shippingStatus || "").toLowerCase();
  const map = {
    pending: "shipping.pending",
    preparing: "shipping.preparing",
    shipped: "shipping.shipped",
    on_hold: "shipping.on_hold",
    delivered: "shipping.delivered",
    out_for_delivery: "order.shipment_timeline.out_for_delivery",
    in_transit: "order.shipment_timeline.out_for_delivery",
  };
  const key = map[s];
  if (key) return t(key);
  return String(o.shipping_status || o.shippingStatus || o.status || "—");
});

const trackExternalUrl = computed(() => {
  const o = props.order;
  if (!o) return "#";
  const direct = o.courier_tracking_url || o.courierTrackingUrl;
  if (typeof direct === "string" && direct.trim().startsWith("http")) return direct.trim();
  const n = trackingNumber.value;
  if (n) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${courierName.value} ${n} track`)}`;
  }
  return "#";
});

function close() {
  isOpen.value = false;
}

const updatedAt = computed(() => {
  const o = props.order;
  const raw = o?.date_updated || o?.updated_at || o?.date_modified || o?.date_created;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
});
</script>

<template>
  <UModal
    v-model="isOpen"
    :ui="{
      overlay: {
        background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm',
      },
      width: 'w-full sm:max-w-md',
    }"
  >
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h3 class="text-xl font-bold text-black dark:text-white">
          {{ $t('order.tracking_modal.title') }}
        </h3>
        <button
          type="button"
          class="rounded-lg p-2 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          @click="close"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
        </button>
      </div>

      <div
        class="mb-6 rounded-2xl border-2 border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-700 dark:bg-neutral-900/40"
      >
        <div class="mb-4 flex items-center gap-3">
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow dark:bg-neutral-800"
          >
            <img
              v-if="courierLogo"
              :src="courierLogo"
              :alt="courierName"
              class="h-full w-full object-contain p-1"
            />
            <UIcon v-else name="i-heroicons-truck" class="h-8 w-8 text-alizarin-crimson-600 dark:text-alizarin-crimson-400" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {{ $t('order.tracking_modal.courier_label') }}
            </p>
            <p class="truncate font-semibold text-black dark:text-white">
              {{ courierName }}
            </p>
          </div>
        </div>

        <div class="space-y-3 text-sm">
          <div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ $t('order.tracking_number_label') }}
            </p>
            <p class="font-mono text-base font-semibold text-black dark:text-white">
              {{ trackingNumber || '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ $t('order.tracking_modal.live_status') }}
            </p>
            <p class="font-medium text-black dark:text-white">
              {{ liveStatus }}
            </p>
            <p v-if="updatedAt" class="mt-1 text-xs text-neutral-500">
              {{ $t('order.tracking_modal.updated_at', { time: updatedAt }) }}
            </p>
          </div>
        </div>
      </div>

      <a
        :href="trackExternalUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-alizarin-crimson-600 px-4 py-3 font-semibold text-white shadow transition hover:bg-alizarin-crimson-700 dark:bg-alizarin-crimson-500 dark:hover:bg-alizarin-crimson-600"
      >
        <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-5 w-5" />
        {{ $t('order.tracking_modal.open_courier') }}
      </a>

      <button
        type="button"
        class="w-full rounded-xl bg-neutral-200 px-4 py-3 font-semibold text-black transition hover:bg-neutral-300 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
        @click="close"
      >
        {{ $t('order.tracking_modal.close') }}
      </button>
    </div>
  </UModal>
</template>
