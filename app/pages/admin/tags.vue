<script setup lang="ts">
import { push } from "notivue";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { adminFetch } = useAdminFetch();

const isLoading = ref(true);
const tags = ref<any[]>([]);
const error = ref<string | null>(null);
const editingTag = ref<any | null>(null);

function unwrapData(res: unknown): any {
  const r = res as { success?: boolean; data?: unknown } | null;
  if (r && typeof r === "object" && r.success === true && r.data != null) {
    return r.data;
  }
  return res;
}

async function load() {
  isLoading.value = true;
  error.value = null;
  try {
    const raw = await adminFetch<unknown>("tags");
    const data = unwrapData(raw);
    const list =
      (data as any)?.tags ?? (data as any)?.productTags?.nodes ?? [];
    tags.value = Array.isArray(list) ? list : [];

    if (editingTag.value) {
      const sid = String(editingTag.value.id || editingTag.value.databaseId);
      const found = tags.value.find(
        (x: { id?: string; databaseId?: string }) =>
          String(x.id || x.databaseId) === sid
      );
      editingTag.value = found || null;
    }
  } catch (e: any) {
    error.value =
      e?.data?.error?.message || e?.data?.message || e?.message || "Error";
    tags.value = [];
  } finally {
    isLoading.value = false;
  }
}

function onEdit(tag: any) {
  editingTag.value = tag;
}

function onEditCancelled() {
  editingTag.value = null;
}

async function onEditUpdated() {
  await load();
}

async function onRemove(tag: any) {
  const id = String(tag?.id || tag?.databaseId || "").trim();
  const name = String(tag?.name || "").trim() || id;
  if (!id) return;
  if (!confirm(t("admin.tags.confirm_remove", { name }))) return;
  try {
    await adminFetch("delete-tag", {
      method: "POST",
      body: { tag_id: id },
    });
    push.success(t("admin.tags.removed"));
    if (
      editingTag.value &&
      String(editingTag.value.id || editingTag.value.databaseId) === id
    ) {
      editingTag.value = null;
    }
    await load();
  } catch (e: any) {
    push.error(
      e?.data?.error?.message || e?.message || t("admin.tags.remove_fail")
    );
  }
}

const selectedEditId = computed(() =>
  editingTag.value
    ? String(editingTag.value.id || editingTag.value.databaseId || "")
    : null
);

onMounted(() => load());
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.tags.title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.tags.lead") }}
      </p>
    </div>

    <div class="grid lg:grid-cols-2 gap-8 items-start">
      <AdminTagCreateForm @created="load" />
      <AdminTagEditForm
        :tag="editingTag"
        @updated="onEditUpdated"
        @cancelled="onEditCancelled"
      />
    </div>

    <AdminTagTable
      :items="tags"
      :loading="isLoading"
      :error="error"
      :selected-id="selectedEditId"
      @edit="onEdit"
      @remove="onRemove"
    />
  </div>
</template>
