<script setup lang="ts">
const props = defineProps<{
  items: any[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
}>();

const emit = defineEmits<{
  edit: [cat: any];
  remove: [cat: any];
}>();

const { t } = useI18n();
const { imageSrc, imageDisplayUrl } = useAdminCategoryImage();

function rowId(cat: any): string {
  return String(cat?.id || cat?.databaseId || "");
}
</script>

<template>
  <UCard>
    <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
      {{ t("admin.categories.list_heading") }}
    </h2>

    <div v-if="loading" class="py-12 text-center text-neutral-500">
      {{ t("general.loading") }}
    </div>
    <div v-else-if="error" class="py-8 text-center text-red-600">
      {{ error }}
    </div>
    <div v-else-if="!items.length" class="py-12 text-center text-neutral-500">
      {{ t("admin.categories.empty") }}
    </div>

    <div v-else class="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table class="w-full text-sm text-left">
        <thead>
          <tr
            class="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400"
          >
            <th class="py-3 px-4 font-medium w-20">{{ t("admin.categories.col_image") }}</th>
            <th class="py-3 px-4 font-medium">{{ t("admin.categories.col_name") }}</th>
            <th class="py-3 px-4 font-medium min-w-[8rem]">{{ t("admin.categories.col_slug") }}</th>
            <th class="py-3 px-4 font-medium text-right w-44">{{ t("admin.categories.col_actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="cat in items"
            :key="rowId(cat)"
            class="border-b border-neutral-100 dark:border-neutral-800/80 transition-colors"
            :class="{
              'bg-alizarin-crimson-50/50 dark:bg-alizarin-crimson-950/20':
                selectedId && selectedId === rowId(cat),
            }"
          >
            <td class="py-3 px-4 align-middle">
              <div
                class="h-12 w-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 overflow-hidden border border-neutral-200 dark:border-neutral-700"
              >
                <img
                  v-if="imageSrc(cat)"
                  :src="imageDisplayUrl(imageSrc(cat))"
                  :alt="cat.name"
                  class="h-full w-full object-cover"
                />
                <div v-else class="h-full w-full flex items-center justify-center">
                  <UIcon name="i-heroicons-photo" class="w-5 h-5 text-neutral-400" />
                </div>
              </div>
            </td>
            <td class="py-3 px-4 align-middle font-medium text-neutral-900 dark:text-white">
              {{ cat.name }}
            </td>
            <td class="py-3 px-4 align-middle font-mono text-xs text-neutral-600 dark:text-neutral-400">
              {{ cat.slug }}
            </td>
            <td class="py-3 px-4 align-middle text-right whitespace-nowrap space-x-2">
              <UButton size="xs" color="neutral" variant="soft" @click="emit('edit', cat)">
                {{ t("admin.categories.edit") }}
              </UButton>
              <UButton size="xs" color="red" variant="soft" @click="emit('remove', cat)">
                {{ t("admin.categories.remove") }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
