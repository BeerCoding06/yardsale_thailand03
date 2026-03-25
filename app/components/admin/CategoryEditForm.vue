<script setup lang="ts">
import { push } from "notivue";

const props = defineProps<{
  category: any | null;
}>();

const emit = defineEmits<{ updated: []; cancelled: [] }>();

const { t } = useI18n();
const { adminFetch } = useAdminFetch();
const { imageSrc, imageDisplayUrl } = useAdminCategoryImage();
const { isUploading, uploadPickedFile } = useAdminCategoryUpload();

const form = ref({
  name: "",
  slug: "",
  image_url: "",
});

const isSubmitting = ref(false);

function syncFromCategory(cat: any | null) {
  if (!cat) {
    form.value = { name: "", slug: "", image_url: "" };
    return;
  }
  form.value = {
    name: String(cat.name || "").trim(),
    slug: String(cat.slug || "").trim(),
    image_url: imageSrc(cat) || "",
  };
}

watch(
  () => props.category,
  (c: any) => syncFromCategory(c),
  { immediate: true, deep: true }
);

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

function cancel() {
  emit("cancelled");
}

async function submit() {
  if (!props.category) return;
  const id = String(props.category.id || props.category.databaseId || "").trim();
  if (!id) return;

  const name = String(form.value.name || "").trim();
  if (!name) {
    push.error(t("admin.categories.validation_name"));
    return;
  }
  isSubmitting.value = true;
  try {
    const slug = String(form.value.slug || "").trim().toLowerCase();
    const img = String(form.value.image_url || "").trim();
    await adminFetch("update-category", {
      method: "POST",
      body: {
        category_id: id,
        name,
        slug,
        image_url: img === "" ? null : img,
      },
    });
    push.success(t("admin.categories.updated"));
    emit("updated");
  } catch (e: any) {
    push.error(
      e?.data?.error?.message ||
        e?.message ||
        t("admin.categories.update_fail")
    );
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UCard class="h-full">
    <h2 class="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
      {{ t("admin.categories.form_heading_edit") }}
    </h2>

    <div
      v-if="!category"
      class="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900/40 px-4 py-10 text-center text-sm text-neutral-500"
    >
      {{ t("admin.categories.edit_select_hint") }}
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
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
      <div class="flex flex-wrap gap-2">
        <UButton type="submit" color="red" :loading="isSubmitting" :disabled="isUploading">
          {{ t("admin.categories.submit_update") }}
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          :disabled="isSubmitting"
          @click="cancel"
        >
          {{ t("admin.categories.cancel_edit") }}
        </UButton>
      </div>
    </form>
  </UCard>
</template>
