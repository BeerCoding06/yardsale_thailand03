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
</script>

<template>
  <div
    class="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 mb-4"
  >
    <div v-if="showSearch" class="flex-1 min-w-[12rem] max-w-md">
      <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
        {{ t("pagination.search") }}
      </label>
      <UInput
        v-model="localSearch"
        size="sm"
        :placeholder="t('pagination.search_placeholder')"
        icon="i-heroicons-magnifying-glass"
        :disabled="loading"
      />
    </div>
    <div
      class="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
    >
      <span v-if="total >= 0" class="whitespace-nowrap">
        {{ t("pagination.total_items", { n: total }) }}
      </span>
      <span class="whitespace-nowrap">
        {{
          totalPages > 0
            ? t("pagination.page_of", { page, total: totalPages })
            : t("pagination.page_none")
        }}
      </span>
      <div class="flex gap-1">
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :disabled="loading || page <= 1"
          @click="goPrev"
        >
          {{ t("pagination.prev") }}
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :disabled="loading || totalPages <= 0 || page >= totalPages"
          @click="goNext"
        >
          {{ t("pagination.next") }}
        </UButton>
      </div>
    </div>
  </div>
</template>
