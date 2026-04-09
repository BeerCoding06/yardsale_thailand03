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
const { resolveMediaUrl } = useStorefrontCatalog();

const MODERATION_ISSUE_OPTIONS = [
  { key: "photos" },
  { key: "title_name" },
  { key: "description" },
  { key: "price" },
  { key: "category" },
  { key: "stock" },
  { key: "tags" },
  { key: "illegal_or_prohibited" },
  { key: "other" },
] as const;

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
    products.value = list.map((p: any) => ({
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
  const out: Record<string, unknown> = {
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
  const iu = row?.image_urls;
  if (Array.isArray(iu) && iu.length) {
    out.image_urls = iu
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
  }
  if (row?.sale_price != null && row.sale_price !== "") {
    const sp = Number(row.sale_price);
    if (Number.isFinite(sp) && sp > 0) out.sale_price = sp;
  }
  return out;
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

const reviewOpen = ref(false);
const reviewRow = ref<any | null>(null);
const rejectNote = ref("");
const issueChecked = reactive<Record<string, boolean>>(
  Object.fromEntries(MODERATION_ISSUE_OPTIONS.map((o) => [o.key, false]))
);
const reviewSubmitting = ref(false);

function resetReviewForm() {
  rejectNote.value = "";
  for (const o of MODERATION_ISSUE_OPTIONS) {
    issueChecked[o.key] = false;
  }
}

function openReview(row: any) {
  reviewRow.value = row;
  resetReviewForm();
  reviewOpen.value = true;
}

function closeReview() {
  reviewOpen.value = false;
  reviewRow.value = null;
  resetReviewForm();
}

function reviewImageUrls(row: any): string[] {
  const urls: string[] = [];
  const iu = row?.image_urls;
  if (Array.isArray(iu)) {
    for (const u of iu) {
      const s = String(u || "").trim();
      if (s) urls.push(s);
    }
  }
  const primary = row?.image_url;
  if (typeof primary === "string" && primary.trim()) {
    const p = primary.trim();
    if (!urls.includes(p)) urls.unshift(p);
  }
  return urls;
}

function reviewMediaSrc(path: string): string {
  return resolveMediaUrl(path) ?? path;
}

async function submitApproveFromReview() {
  const row = reviewRow.value;
  if (!row?.id) return;
  const id = String(row.id);
  const prev = listingStatusValue(row);
  reviewSubmitting.value = true;
  try {
    const full = buildFullUpdateBody(row, "published");
    await adminFetch("update-product", {
      method: "POST",
      body: full ?? { product_id: id, listing_status: "published" },
    });
    push.success(t("admin.products.review_approved"));
    closeReview();
    await load();
  } catch (e: any) {
    row.listing_status = prev;
    push.error(
      e?.data?.error?.message ||
        e?.message ||
        t("admin.products.review_action_failed")
    );
  } finally {
    reviewSubmitting.value = false;
  }
}

async function submitRejectFromReview() {
  const row = reviewRow.value;
  if (!row?.id) return;
  const id = String(row.id);
  const keys = MODERATION_ISSUE_OPTIONS.filter((o) => issueChecked[o.key]).map(
    (o) => o.key
  );
  const msg = rejectNote.value.trim();
  if (!keys.length && !msg) {
    push.error(t("admin.products.review_need_reason"));
    return;
  }
  const prev = listingStatusValue(row);
  reviewSubmitting.value = true;
  try {
    const base =
      buildFullUpdateBody(row, "hidden") ?? {
        product_id: id,
        listing_status: "hidden",
      };
    await adminFetch("update-product", {
      method: "POST",
      body: {
        ...base,
        listing_status: "hidden",
        moderation_issue_keys: keys,
        moderation_message: msg || null,
      },
    });
    push.success(t("admin.products.review_rejected"));
    closeReview();
    await load();
  } catch (e: any) {
    row.listing_status = prev;
    push.error(
      e?.data?.error?.message ||
        e?.message ||
        t("admin.products.review_action_failed")
    );
  } finally {
    reviewSubmitting.value = false;
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
                  color="primary"
                  variant="soft"
                  @click="openReview(row)"
                >
                  {{ t("admin.products.review") }}
                </UButton>
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

    <UModal
      v-model="reviewOpen"
      :ui="{
        overlay: { background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm' },
        background: 'bg-white dark:bg-neutral-900',
        width: 'w-full sm:max-w-lg',
        rounded: 'rounded-2xl',
      }"
    >
      <div
        v-if="reviewRow"
        class="p-6 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          {{ t("admin.products.review_title") }}
        </h3>

        <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 space-y-3 text-sm">
          <p class="font-medium text-neutral-900 dark:text-white">
            {{ reviewRow.name }}
          </p>
          <div
            v-if="reviewImageUrls(reviewRow).length"
            class="flex flex-wrap gap-2"
          >
            <img
              v-for="(src, idx) in reviewImageUrls(reviewRow)"
              :key="idx"
              :src="reviewMediaSrc(src)"
              :alt="`${reviewRow.name} ${idx + 1}`"
              class="h-20 w-20 rounded-lg object-cover border border-neutral-200 dark:border-neutral-600"
            />
          </div>
          <dl class="grid grid-cols-1 gap-2 text-neutral-700 dark:text-neutral-300">
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ t("admin.products.review_field_description") }}
              </dt>
              <dd class="whitespace-pre-wrap break-words mt-0.5">
                {{ reviewRow.description || "—" }}
              </dd>
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1">
              <div>
                <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t("admin.products.col_price") }}
                </dt>
                <dd class="tabular-nums">
                  {{ reviewRow.price ?? "—" }}
                  <template v-if="reviewRow.regular_price != null">
                    / {{ t("admin.products.review_regular") }}
                    {{ reviewRow.regular_price }}
                  </template>
                  <template v-if="reviewRow.sale_price != null && reviewRow.sale_price !== ''">
                    · {{ t("admin.products.review_sale") }} {{ reviewRow.sale_price }}
                  </template>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                  {{ t("admin.products.col_stock") }}
                </dt>
                <dd>{{ reviewRow.stock ?? "—" }}</dd>
              </div>
            </div>
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ t("admin.products.review_field_category") }}
              </dt>
              <dd class="font-mono text-xs break-all">
                {{ reviewRow.category_id || "—" }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ t("admin.products.review_field_seller") }}
              </dt>
              <dd class="font-mono text-xs break-all">
                {{ reviewRow.seller_id || "—" }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ t("admin.products.form_listing_status") }}
              </dt>
              <dd>{{ listingStatusValue(reviewRow) }}</dd>
            </div>
            <div v-if="reviewRow.created_at">
              <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ t("admin.products.review_created_at") }}
              </dt>
              <dd>{{ reviewRow.created_at }}</dd>
            </div>
          </dl>
        </div>

        <div
          class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 p-4 space-y-3"
        >
          <p class="text-sm font-medium text-amber-950 dark:text-amber-100">
            {{ t("admin.products.review_reject_section") }}
          </p>
          <p class="text-xs text-amber-900/80 dark:text-amber-200/90">
            {{ t("admin.products.review_reject_hint") }}
          </p>
          <ul class="space-y-2">
            <li
              v-for="opt in MODERATION_ISSUE_OPTIONS"
              :key="opt.key"
              class="flex items-start gap-2"
            >
              <input
                :id="`mod-${opt.key}`"
                v-model="issueChecked[opt.key]"
                type="checkbox"
                class="mt-1 rounded border-neutral-300 text-alizarin-crimson-600 focus:ring-alizarin-crimson-500"
              />
              <label
                :for="`mod-${opt.key}`"
                class="text-sm text-neutral-800 dark:text-neutral-200 cursor-pointer"
              >
                {{ t(`admin.products.review_issue_${opt.key}`) }}
              </label>
            </li>
          </ul>
          <UFormGroup :label="t('admin.products.review_message_label')">
            <textarea
              v-model="rejectNote"
              rows="4"
              :placeholder="t('admin.products.review_message_placeholder')"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-alizarin-crimson-500"
            />
          </UFormGroup>
        </div>

        <div class="flex flex-wrap gap-2 justify-end pt-2">
          <UButton
            variant="ghost"
            color="neutral"
            :disabled="reviewSubmitting"
            @click="closeReview"
          >
            {{ t("admin.products.review_close") }}
          </UButton>
          <UButton
            color="green"
            variant="soft"
            :loading="reviewSubmitting"
            :disabled="reviewRow.is_cancelled"
            @click="submitApproveFromReview"
          >
            {{ t("admin.products.review_approve") }}
          </UButton>
          <UButton
            color="red"
            :loading="reviewSubmitting"
            :disabled="reviewRow.is_cancelled"
            @click="submitRejectFromReview"
          >
            {{ t("admin.products.review_reject_submit") }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
