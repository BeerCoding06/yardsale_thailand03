<script setup lang="ts">
import { push } from "notivue";

const emit = defineEmits<{ created: [] }>();

const { t } = useI18n();
const { adminFetch } = useAdminFetch();

const form = ref({
  name: "",
  slug: "",
});

const isSubmitting = ref(false);

function reset() {
  form.value = { name: "", slug: "" };
}

async function submit() {
  const name = String(form.value.name || "").trim();
  if (!name) {
    push.error(t("admin.tags.validation_name"));
    return;
  }
  isSubmitting.value = true;
  try {
    const slug = String(form.value.slug || "").trim().toLowerCase();
    const body: Record<string, unknown> = { name };
    if (slug) body.slug = slug;
    await adminFetch("create-tag", { method: "POST", body });
    push.success(t("admin.tags.created"));
    reset();
    emit("created");
  } catch (e: any) {
    push.error(
      e?.data?.error?.message || e?.message || t("admin.tags.create_fail")
    );
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard>
    <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
      {{ t("admin.tags.form_heading") }}
    </h2>
    <form class="space-y-4" @submit.prevent="submit">
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
      <UButton type="submit" color="red" :loading="isSubmitting">
        {{ t("admin.tags.submit") }}
      </UButton>
    </form>
  </UCard>
</template>
