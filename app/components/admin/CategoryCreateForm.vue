<script setup lang="ts">
import { push } from "notivue";

const emit = defineEmits<{ created: [] }>();

const { t } = useI18n();
const { adminFetch } = useAdminFetch();
const { imageDisplayUrl } = useAdminCategoryImage();
const { isUploading, uploadPickedFile } = useAdminCategoryUpload();

const form = ref({
  name: "",
  slug: "",
  image_url: "",
});

const isSubmitting = ref(false);

function reset() {
  form.value = { name: "", slug: "", image_url: "" };
}

async function onPickFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const url = await uploadPickedFile(file);
    if (url) {
      form.value.image_url = url;
      push.success(t("admin.categories.upload_ok"));
    } else {
      push.error(t("admin.categories.upload_fail"));
    }
  } catch (err: any) {
    push.error(
      err?.data?.error?.message ||
        err?.message ||
        t("admin.categories.upload_fail")
    );
  } finally {
    input.value = "";
  }
}

async function submit() {
  const name = String(form.value.name || "").trim();
  if (!name) {
    push.error(t("admin.categories.validation_name"));
    return;
  }
  isSubmitting.value = true;
  try {
    const slug = String(form.value.slug || "").trim().toLowerCase();
    const img = String(form.value.image_url || "").trim();
    const body: Record<string, unknown> = { name };
    if (slug) body.slug = slug;
    if (img) body.image_url = img;
    await adminFetch("create-category", { method: "POST", body });
    push.success(t("admin.categories.created"));
    reset();
    emit("created");
  } catch (e: any) {
    push.error(
      e?.data?.error?.message ||
        e?.message ||
        t("admin.categories.create_fail")
    );
  } finally {
    isSubmitting.value = false;
  }
}

</script>

<template>
  <UCard>
    <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
      {{ t("admin.categories.form_heading") }}
    </h2>
    <form class="space-y-4" @submit.prevent="submit">
      <UFormGroup :label="t('admin.categories.form_name')" required>
        <UInput v-model="form.name" :placeholder="t('admin.categories.placeholder_name')" />
      </UFormGroup>
      <UFormGroup
        :label="t('admin.categories.form_slug')"
        :description="t('admin.categories.slug_hint')"
      >
        <UInput
          v-model="form.slug"
          :placeholder="t('admin.categories.placeholder_slug')"
        />
      </UFormGroup>
      <UFormGroup
        :label="t('admin.categories.form_image')"
        :description="t('admin.categories.image_hint')"
      >
        <div class="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="text-sm text-neutral-600 dark:text-neutral-400"
            @change="onPickFile"
          />
          <UButton
            v-if="form.image_url"
            type="button"
            size="xs"
            color="neutral"
            variant="soft"
            @click="form.image_url = ''"
          >
            {{ t("admin.categories.clear_image") }}
          </UButton>
        </div>
        <p v-if="isUploading" class="text-xs text-neutral-500 mt-1">
          {{ t("admin.categories.uploading") }}
        </p>
        <div v-if="form.image_url" class="mt-3">
          <img
            :src="imageDisplayUrl(form.image_url)"
            alt=""
            class="h-24 w-24 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700"
          />
          <p class="text-xs text-neutral-500 mt-1 break-all">{{ form.image_url }}</p>
        </div>
      </UFormGroup>
      <UButton type="submit" color="red" :loading="isSubmitting" :disabled="isUploading">
        {{ t("admin.categories.submit") }}
      </UButton>
    </form>
  </UCard>
</template>
