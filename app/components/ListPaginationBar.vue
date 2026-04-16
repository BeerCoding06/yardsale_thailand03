<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    loading?: boolean;
    search?: string;
    showSearch?: boolean;
  }>(),
  {
    loading: false,
    search: "",
    showSearch: true,
  }
);

const emit = defineEmits<{
  "update:page": [v: number];
  "update:search": [v: string];
}>();

const { t } = useI18n();

const localSearch = ref(props.search || "");

watch(
  () => props.search,
  (v) => {
    localSearch.value = v ?? "";
  }
);

const debouncedEmitSearch = useDebounceFn(() => {
  emit("update:search", String(localSearch.value).trim());
}, 400);

watch(localSearch, () => {
  debouncedEmitSearch();
});

function goPrev() {
  if (props.page > 1) emit("update:page", props.page - 1);
}

function goNext() {
  if (props.page < props.totalPages) emit("update:page", props.page + 1);
}

const navDisabled = computed(
  () => props.loading || props.totalPages <= 0
);
</script>

<template>
  <div
    class="list-pagination-bar"
    role="navigation"
    :aria-busy="loading"
    :aria-label="t('pagination.nav_aria')"
  >
    <div
      class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between"
    >
      <div v-if="showSearch" class="min-w-0 w-[50%] md:w-[150px] sm:max-w-md">
        <label
          class="mb-1.5 block text-sm font-semibold text-black dark:text-white"
        >
          {{ t("pagination.search") }}
        </label>
        <UInput
          v-model="localSearch"
          size="md"
          :placeholder="t('pagination.search_placeholder')"
          icon="i-heroicons-magnifying-glass"
          :disabled="loading"
          :ui="{
            rounded: 'rounded-xl',
            size: { md: 'text-sm' },
            base: 'border-2 border-neutral-200 bg-white/80 text-black placeholder:text-neutral-400 focus:border-alizarin-crimson-600 dark:border-neutral-700 dark:bg-black/30 dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-alizarin-crimson-500',
          }"
        />
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4"
      >
        <div
          class="flex gap-1 text-sm text-neutral-600 dark:text-neutral-400 sm:text-right"
        >
          <span
            v-if="total >= 0"
            class="inline-flex items-center gap-2 font-medium text-neutral-700 dark:text-neutral-300"
          >
            <UIcon
              name="i-heroicons-squares-2x2"
              class="h-4 w-4 shrink-0 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
            />
            {{ t("pagination.total_items", { n: total }) }}
          </span>
          <span
            class="inline-flex w-fit items-center rounded-xl border-2 border-alizarin-crimson-200 bg-alizarin-crimson-50 px-3 py-1.5 text-sm font-semibold text-alizarin-crimson-900 dark:border-alizarin-crimson-800 dark:bg-alizarin-crimson-950/50 dark:text-alizarin-crimson-100"
          >
            <UIcon
              v-if="loading"
              name="i-svg-spinners-90-ring-with-bg"
              class="mr-2 h-4 w-4 shrink-0 text-alizarin-crimson-600 dark:text-alizarin-crimson-400"
            />
            {{
              totalPages > 0
                ? t("pagination.page_of", { page, total: totalPages })
                : t("pagination.page_none")
            }}
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex min-h-[2.75rem] min-w-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-alizarin-crimson-500 hover:text-alizarin-crimson-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-100 dark:hover:border-alizarin-crimson-500 dark:hover:text-alizarin-crimson-300 sm:flex-initial"
            :disabled="loading || page <= 1 || totalPages <= 0"
            @click="goPrev"
          >
            <UIcon name="i-heroicons-chevron-left" class="h-5 w-5" />
            <span class="sm:inline">{{ t("pagination.prev") }}</span>
          </button>
          <button
            type="button"
            class="inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-alizarin-crimson-600 bg-alizarin-crimson-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:border-alizarin-crimson-700 hover:bg-alizarin-crimson-700 active:scale-[0.98] disabled:pointer-events-none disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-neutral-500 dark:border-alizarin-crimson-500 dark:bg-alizarin-crimson-500 dark:hover:border-alizarin-crimson-600 dark:hover:bg-alizarin-crimson-600 dark:disabled:border-neutral-700 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500 sm:flex-initial sm:min-w-[7.5rem]"
            :disabled="navDisabled || page >= totalPages"
            @click="goNext"
          >
            <span class="sm:inline">{{ t("pagination.next") }}</span>
            <UIcon name="i-heroicons-chevron-right" class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
