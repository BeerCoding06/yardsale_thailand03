<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
const { adminFetch } = useAdminFetch();
const { push } = useNotivue();

const isLoading = ref(true);
const products = ref<any[]>([]);
const error = ref<string | null>(null);

async function load() {
  isLoading.value = true;
  error.value = null;
  try {
    const res = await adminFetch<any>("my-products");
    const raw = res as any;
    const list = Array.isArray(raw?.products)
      ? raw.products
      : Array.isArray(raw?.data?.products)
        ? raw.data.products
        : Array.isArray(raw?.data?.data?.products)
          ? raw.data.data.products
          : [];
    products.value = list;
  } catch (e: any) {
    error.value =
      e?.data?.error?.message || e?.data?.message || e?.message || "Error";
    products.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function cancelProduct(id: string) {
  if (!confirm(t("admin.products.confirm_cancel"))) return;
  try {
    await adminFetch("product/cancel", {
      method: "POST",
      body: { product_id: id },
    });
    push.success(t("admin.products.cancelled"));
    await load();
  } catch (e: any) {
    push.error(
      e?.data?.error?.message || e?.message || t("admin.products.action_failed")
    );
  }
}

async function restoreProduct(id: string) {
  try {
    await adminFetch("product/restore", {
      method: "POST",
      body: { product_id: id },
    });
    push.success(t("admin.products.restored"));
    await load();
  } catch (e: any) {
    push.error(
      e?.data?.error?.message || e?.message || t("admin.products.action_failed")
    );
  }
}

const updatingListingId = ref<string | null>(null);

function listingStatusValue(row: any): "pending_review" | "published" | "hidden" {
  const s = row?.listing_status;
  if (s === "published" || s === "hidden" || s === "pending_review") return s;
  return "pending_review";
}

async function updateListingStatus(row: any, next: string) {
  const id = String(row?.id || "");
  if (!id) return;
  const allowed = ["pending_review", "published", "hidden"] as const;
  if (!allowed.includes(next as (typeof allowed)[number])) return;
  const prev = listingStatusValue(row);
  if (prev === next) return;

  updatingListingId.value = id;
  row.listing_status = next;
  try {
    await adminFetch("update-product", {
      method: "POST",
      body: { product_id: id, listing_status: next },
    });
    push.success(t("admin.products.listing_status_saved"));
  } catch (e: any) {
    row.listing_status = prev;
    push.error(
      e?.data?.error?.message ||
        e?.message ||
        t("admin.products.listing_status_save_failed")
    );
  } finally {
    updatingListingId.value = null;
  }
}

function onListingStatusChange(row: any, e: Event) {
  const el = e.target as HTMLSelectElement | null;
  if (!el) return;
  updateListingStatus(row, el.value);
}

onMounted(() => load());
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
          {{ t("admin.products.title") }}
        </h1>
        <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
          {{ t("admin.products.list_lead") }}
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-heroicons-arrow-path"
          @click="load"
        >
          {{ t("common.reload") }}
        </UButton>
        <UButton
          color="red"
          :to="localePath('/admin/products/new')"
          icon="i-heroicons-plus"
        >
          {{ t("admin.products.new") }}
        </UButton>
      </div>
    </div>

    <UCard>
      <div v-if="isLoading" class="py-12 text-center text-neutral-500">
        {{ t("general.loading") }}
      </div>
      <div v-else-if="error" class="py-8 text-center text-red-600">
        {{ error }}
      </div>
      <div v-else-if="!products.length" class="py-12 text-center text-neutral-500">
        {{ t("admin.products.empty") }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr
              class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
            >
              <th class="text-left py-2 pr-3 font-medium">{{ t("admin.products.col_name") }}</th>
              <th class="text-right py-2 pr-3 font-medium">{{ t("admin.products.col_price") }}</th>
              <th class="text-right py-2 pr-3 font-medium">{{ t("admin.products.col_stock") }}</th>
              <th class="text-left py-2 pr-3 font-medium">{{ t("admin.products.col_status") }}</th>
              <th class="text-right py-2 font-medium">{{ t("admin.products.col_actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in products"
              :key="row.id"
              class="border-b border-neutral-100 dark:border-neutral-800"
            >
              <td class="py-3 pr-3 font-medium text-neutral-900 dark:text-white">
                {{ row.name }}
              </td>
              <td class="py-3 pr-3 text-right tabular-nums">
                {{ row.price }}
              </td>
              <td class="py-3 pr-3 text-right tabular-nums">
                {{ row.stock ?? "—" }}
              </td>
              <td class="py-3 pr-3">
                <div class="flex flex-col gap-2 min-w-[11rem]">
                  <select
                    :value="listingStatusValue(row)"
                    :disabled="
                      updatingListingId === row.id || row.is_cancelled
                    "
                    class="w-full max-w-[14rem] rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-2 py-1.5 text-xs text-neutral-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    :aria-label="t('admin.products.form_listing_status')"
                    @change="onListingStatusChange(row, $event)"
                  >
                    <option value="pending_review">
                      {{ t("admin.products.listing_pending_review") }}
                    </option>
                    <option value="published">
                      {{ t("admin.products.listing_published") }}
                    </option>
                    <option value="hidden">
                      {{ t("admin.products.listing_hidden") }}
                    </option>
                  </select>
                  <span
                    v-if="row.is_cancelled"
                    class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 w-fit"
                  >
                    {{ t("admin.products.status_cancelled") }}
                  </span>
                </div>
              </td>
              <td class="py-3 text-right whitespace-nowrap space-x-2">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :to="localePath(`/admin/products/${row.id}`)"
                >
                  {{ t("admin.products.edit") }}
                </UButton>
                <UButton
                  v-if="!row.is_cancelled"
                  size="xs"
                  color="red"
                  variant="soft"
                  @click="cancelProduct(row.id)"
                >
                  {{ t("admin.products.hide") }}
                </UButton>
                <UButton
                  v-else
                  size="xs"
                  color="green"
                  variant="soft"
                  @click="restoreProduct(row.id)"
                >
                  {{ t("admin.products.restore") }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
