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
const categories = ref<any[]>([]);
const error = ref<string | null>(null);
const editingCategory = ref<any | null>(null);

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
    const raw = await adminFetch<unknown>("categories");
    const data = unwrapData(raw);
    const list =
      (data as any)?.categories ??
      (data as any)?.productCategories?.nodes ??
      [];
    categories.value = Array.isArray(list) ? list : [];

    if (editingCategory.value) {
      const sid = String(
        editingCategory.value.id || editingCategory.value.databaseId
      );
      const found = categories.value.find(
        (c: { id?: string; databaseId?: string }) =>
          String(c.id || c.databaseId) === sid
      );
      editingCategory.value = found || null;
    }
  } catch (e: any) {
    error.value =
      e?.data?.error?.message || e?.data?.message || e?.message || "Error";
    categories.value = [];
  } finally {
    isLoading.value = false;
  }
}

function onEdit(cat: any) {
  editingCategory.value = cat;
}

function onEditCancelled() {
  editingCategory.value = null;
}

async function onEditUpdated() {
  await load();
}

async function onRemove(cat: any) {
  const id = String(cat?.id || cat?.databaseId || "").trim();
  const name = String(cat?.name || "").trim() || id;
  if (!id) return;
  if (!confirm(t("admin.categories.confirm_remove", { name }))) return;
  try {
    await adminFetch("delete-category", {
      method: "POST",
      body: { category_id: id },
    });
    push.success(t("admin.categories.removed"));
    if (
      editingCategory.value &&
      String(editingCategory.value.id || editingCategory.value.databaseId) === id
    ) {
      editingCategory.value = null;
    }
    await load();
  } catch (e: any) {
    push.error(
      e?.data?.error?.message ||
        e?.message ||
        t("admin.categories.remove_fail")
    );
  }
}

const selectedEditId = computed(() =>
  editingCategory.value
    ? String(editingCategory.value.id || editingCategory.value.databaseId || "")
    : null
);

onMounted(() => load());
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.categories.title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.categories.lead") }}
      </p>
    </div>

    <div class="grid lg:grid-cols-2 gap-8 items-start">
      <AdminCategoryCreateForm @created="load" />
      <AdminCategoryEditForm
        :category="editingCategory"
        @updated="onEditUpdated"
        @cancelled="onEditCancelled"
      />
    </div>

    <AdminCategoryTable
      :items="categories"
      :loading="isLoading"
      :error="error"
      :selected-id="selectedEditId"
      @edit="onEdit"
      @remove="onRemove"
    />
  </div>
</template>
