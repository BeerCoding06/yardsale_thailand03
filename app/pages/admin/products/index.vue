<script setup lang="ts">
import { push } from "notivue";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const localePath = useLocalePath();
const { adminFetch } = useAdminFetch();

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
    products.value = list.map((p) => ({
      ...p,
      listing_status: normalizeListingStatus(p),
    }));
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

/** ให้ทุกแถวมี listing_status ตรงกับ value ของ <option> — รองรับ string จาก DB / select ที่อาจมีช่องว่างหรือตัวพิมพ์ */
function normalizeListingStatus(input: any): "pending_review" | "published" | "hidden" {
  const raw =
    input != null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    "listing_status" in input
      ? (input as { listing_status?: unknown }).listing_status
      : input;
  const s =
    typeof raw === "string"
      ? raw.trim().toLowerCase()
      : String(raw ?? "")
          .trim()
          .toLowerCase();
  if (s === "published") return "published";
  if (s === "hidden") return "hidden";
  if (s === "pending_review" || s === "pending-review" || s === "pending review")
    return "pending_review";
  return "pending_review";
}

function listingStatusValue(row: any): "pending_review" | "published" | "hidden" {
  return normalizeListingStatus(row);
}

function buildFullUpdateBody(row: any, listing_status: string) {
  const id = String(row?.id || "");
  const name = String(row?.name || "").trim();
  const price = Number(row?.price);
  if (!id || !name || !Number.isFinite(price) || price <= 0) return null;
  const stock = Math.max(0, Number(row?.stock) || 0);
  const cid = row?.category_id;
  const category_id =
    cid != null && String(cid).trim() !== "" ? String(cid) : null;
  const img = row?.image_url;
  const image_url =
    img != null && String(img).trim() !== "" ? String(img).trim() : null;
  const regular_for_api = Number(row?.regular_price ?? row?.price);
  const regular_price =
    Number.isFinite(regular_for_api) && regular_for_api > 0
      ? regular_for_api
      : price;
  return {
    product_id: id,
    listing_status,
    name,
    description: String(row?.description ?? ""),
    price,
    regular_price,
    stock,
    category_id,
    image_url,
  };
}

async function persistListingStatus(row: any, next: string, prev: string) {
  const id = String(row?.id || "");
  if (!id) return;
  const allowed = ["pending_review", "published", "hidden"] as const;
  if (!allowed.includes(next as (typeof allowed)[number])) return;
  if (prev === next) return;

  updatingListingId.value = id;
  try {
    const full = buildFullUpdateBody(row, next);
    await adminFetch("update-product", {
      method: "POST",
      body: full ?? { product_id: id, listing_status: next },
    });
    push.success(t("admin.products.listing_status_saved"));
    await load();
  } catch (e: any) {
    row.listing_status = prev;
    const msg =
      e?.data?.error?.message ||
      e?.data?.message ||
      e?.message ||
      t("admin.products.listing_status_save_failed");
    push.error(msg);
  } finally {
    updatingListingId.value = null;
  }
}

function onListingStatusChange(row: any, e: Event) {
  const el = e.target as HTMLSelectElement | null;
  if (!el) return;
  const next = normalizeListingStatus(el.value);
  const prev = listingStatusValue(row);
  if (prev === next) return;
  row.listing_status = next;
  void persistListingStatus(row, next, prev);
}

/** สีของกล่อง select ตามสถานะที่เลือกอยู่ (ค่าที่ “active”) */
function listingStatusSelectClass(row: any): string {
  const base =
    "w-full max-w-[14rem] rounded-md border px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed";
  if (row?.is_cancelled) {
    return `${base} border-neutral-300 bg-neutral-100 text-neutral-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-500`;
  }
  switch (listingStatusValue(row)) {
    case "published":
      return `${base} border-emerald-500/70 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/30 focus-visible:ring-emerald-500/40 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-500/25 dark:focus-visible:ring-emerald-500/30`;
    case "hidden":
      return `${base} border-neutral-400 bg-neutral-100 text-neutral-900 ring-1 ring-neutral-400/40 focus-visible:ring-neutral-400/50 dark:border-neutral-500 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-500/30 dark:focus-visible:ring-neutral-500/40`;
    case "pending_review":
    default:
      return `${base} border-amber-500/70 bg-amber-50 text-amber-950 ring-1 ring-amber-500/30 focus-visible:ring-amber-500/40 dark:border-amber-500/50 dark:bg-amber-950/35 dark:text-amber-100 dark:ring-amber-500/25 dark:focus-visible:ring-amber-500/30`;
  }
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
              <td class="py-3 pr-3 text-neutral-900 dark:text-white">
                <div class="flex flex-col gap-1">
                  <span class="font-medium">{{ row.name }}</span>
                  <span
                    v-if="row.is_cancelled"
                    class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 w-fit"
                  >
                    {{ t("admin.products.status_cancelled") }}
                  </span>
                </div>
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
                    :key="`${row.id}-${row.listing_status}`"
                    :value="row.listing_status"
                    :disabled="
                      updatingListingId === row.id || row.is_cancelled
                    "
                    :class="listingStatusSelectClass(row)"
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
