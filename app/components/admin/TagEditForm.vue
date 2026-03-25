<script setup lang="ts">
import { push } from "notivue";

const props = defineProps<{
  tag: any | null;
}>();

const emit = defineEmits<{ updated: []; cancelled: [] }>();

const { t } = useI18n();
const { adminFetch } = useAdminFetch();

const form = ref({
  name: "",
  slug: "",
});

const isSubmitting = ref(false);

function syncFromTag(tag: any | null) {
  if (!tag) {
    form.value = { name: "", slug: "" };
    return;
  }
  form.value = {
    name: String(tag.name || "").trim(),
    slug: String(tag.slug || "").trim(),
  };
}

watch(
  () => props.tag,
  (x: any) => syncFromTag(x),
  { immediate: true, deep: true }
);

function cancel() {
  emit("cancelled");
}

async function submit() {
  if (!props.tag) return;
  const id = String(props.tag.id || props.tag.databaseId || "").trim();
  if (!id) return;

  const name = String(form.value.name || "").trim();
  if (!name) {
    push.error(t("admin.tags.validation_name"));
    return;
  }
  isSubmitting.value = true;
  try {
    const slug = String(form.value.slug || "").trim().toLowerCase();
    await adminFetch("update-tag", {
      method: "POST",
      body: {
        tag_id: id,
        name,
        slug,
      },
    });
    push.success(t("admin.tags.updated"));
    emit("updated");
  } catch (e: any) {
    push.error(
      e?.data?.error?.message || e?.message || t("admin.tags.update_fail")
    );
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard class="h-full">
    <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
      {{ t("admin.tags.form_heading_edit") }}
    </h2>

    <div
      v-if="!tag"
      class="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900/40 px-4 py-10 text-center text-sm text-neutral-500"
    >
      {{ t("admin.tags.edit_select_hint") }}
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <UFormGroup :label="t('admin.tags.form_name')" required>
        <UInput v-model="form.name" :placeholder="t('admin.tags.placeholder_name')" />
      </UFormGroup>
      <UFormGroup
        :label="t('admin.tags.form_slug')"
        :description="t('admin.tags.slug_hint')"
      >
        <UInput
          v-model="form.slug"
          :placeholder="t('admin.tags.placeholder_slug')"
        />
      </UFormGroup>
      <div class="flex flex-wrap gap-2">
        <UButton type="submit" color="red" :loading="isSubmitting">
          {{ t("admin.tags.submit_update") }}
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          :disabled="isSubmitting"
          @click="cancel"
        >
          {{ t("admin.tags.cancel_edit") }}
        </UButton>
      </div>
    </form>
  </UCard>
</template>
