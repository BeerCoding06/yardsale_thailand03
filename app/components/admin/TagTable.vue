<script setup lang="ts">
const props = defineProps<{
  items: any[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  edit: [tag: any];
  remove: [tag: any];
}>();

const { t } = useI18n();

function rowId(tag: any): string {
  return String(tag?.id || tag?.databaseId || "");
}
</script>

<template>
  <UCard>
    <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
      {{ t("admin.tags.list_heading") }}
    </h2>

    <div v-if="loading" class="py-12 text-center text-neutral-500">
      {{ t("general.loading") }}
    </div>
    <div v-else-if="error" class="py-8 text-center text-red-600">
      {{ error }}
    </div>
    <div v-else-if="!items.length" class="py-12 text-center text-neutral-500">
      {{ t("admin.tags.empty") }}
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table class="w-full text-sm text-left">
        <thead>
          <tr
            class="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
          >
            <th class="py-3 px-4 font-medium">{{ t("admin.tags.col_name") }}</th>
            <th class="py-3 px-4 font-medium min-w-[8rem]">{{ t("admin.tags.col_slug") }}</th>
            <th class="py-3 px-4 font-medium text-right w-44">{{ t("admin.tags.col_actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tag in items"
            :key="rowId(tag)"
            class="border-b border-neutral-100 dark:border-neutral-800/80 transition-colors"
            :class="{
              'bg-alizarin-crimson-50/50 dark:bg-alizarin-crimson-950/20':
                selectedId && selectedId === rowId(tag),
            }"
          >
            <td class="py-3 px-4 align-middle font-medium text-neutral-900 dark:text-white">
              {{ tag.name }}
            </td>
            <td class="py-3 px-4 align-middle font-mono text-xs text-neutral-600 dark:text-neutral-400">
              {{ tag.slug }}
            </td>
            <td class="py-3 px-4 align-middle text-right whitespace-nowrap space-x-2">
              <UButton size="xs" color="neutral" variant="soft" @click="emit('edit', tag)">
                {{ t("admin.tags.edit") }}
              </UButton>
              <UButton size="xs" color="red" variant="soft" @click="emit('remove', tag)">
                {{ t("admin.tags.remove") }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
