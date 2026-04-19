<script setup lang="ts">
import { push } from "notivue";
import { pickPagination, paginationQuery } from "~/utils/paginationResponse";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { user, checkAuth } = useAuth();
const { endpoint } = useCmsApi();

const ORDER_PAGE_SIZE = 20;
const listPage = ref(1);
const listSearch = ref("");
const orderPagination = ref({
  page: 1,
  page_size: ORDER_PAGE_SIZE,
  total: 0,
  total_pages: 0,
});

const isLoading = ref(true);
const orders = ref<any[]>([]);
const error = ref<string | null>(null);

const SHIP_STATUS_VALUES = [
  "pending",
  "preparing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "on_hold",
] as const;

const PAYMENT_STATUS_VALUES = ["pending", "paid", "canceled", "payment_failed"] as const;

function normalizeShippingStatus(s: unknown): string {
  const v = String(s || "pending")
    .toLowerCase()
    .replace(/-/g, "_");
  return (SHIP_STATUS_VALUES as readonly string[]).includes(v) ? v : "pending";
}

function normalizeOrderRow(row: any) {
  if (!row || typeof row !== "object") return row;
  const o = { ...row };
  o.date_created = o.date_created ?? o.created_at;
  o.tracking_number = o.tracking_number ?? "";
  o.courier_name = o.courier_name ?? "";
  o.shipping_status = normalizeShippingStatus(o.shipping_status);
  if (o.status != null) o.status = String(o.status).toLowerCase().replace("cancelled", "canceled");
  if (o.order_status != null) o.order_status = String(o.order_status);
  return o;
}

function onOrderSearch(q: string) {
  const tq = String(q || "").trim();
  if (tq === listSearch.value) return;
  listSearch.value = tq;
  listPage.value = 1;
  fetchOrders();
}

function onOrderPage(p: number) {
  if (p === listPage.value) return;
  listPage.value = p;
  fetchOrders();
}

function formatDate(dateString: string) {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function pickOrdersPayload(res: any): any[] {
  const inner = res?.data && typeof res.data === "object" ? res.data : res;
  if (Array.isArray(inner?.orders)) return inner.orders;
  if (Array.isArray(res?.orders)) return res.orders;
  return [];
}

async function fetchOrders() {
  const jwt = user.value?.token;
  if (!jwt) {
    error.value = t("auth.login_required");
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  error.value = null;
  try {
    const res = await $fetch<any>(
      endpoint("seller-orders"),
      {
        headers: { Authorization: `Bearer ${jwt}` },
        query: paginationQuery(listPage.value, listSearch.value, ORDER_PAGE_SIZE),
      } as any
    );
    if (res && res.success !== false) {
      const inner = res?.data && typeof res.data === "object" ? res.data : res;
      const list = pickOrdersPayload(res).map(normalizeOrderRow);
      orders.value = list;
      const pg = pickPagination(inner);
      if (pg) {
        orderPagination.value = {
          page: pg.page,
          page_size: pg.page_size,
          total: pg.total,
          total_pages: pg.total_pages,
        };
        listPage.value = pg.page;
      } else {
        orderPagination.value = {
          page: listPage.value,
          page_size: ORDER_PAGE_SIZE,
          total: list.length,
          total_pages: list.length ? 1 : 0,
        };
      }
    } else {
      error.value = res?.error?.message || res?.message || t("seller_orders.error_loading");
      orders.value = [];
    }
  } catch (e: any) {
    error.value = e?.message || t("seller_orders.error_loading");
    orders.value = [];
  } finally {
    isLoading.value = false;
  }
}

const editOpen = ref(false);
const editingId = ref<string | null>(null);
const editBusy = ref(false);
const editForm = reactive({
  status: "pending",
  total_price: "",
  slip_image_url: "",
  shipping_status: "pending",
  tracking_number: "",
  courier_name: "",
  shipping_receipt_number: "",
});

function paymentStatusLabel(key: string) {
  const k = String(key || "").toLowerCase();
  if (k === "payment_failed") return t("order.customer_payment.payment_failed");
  if (k === "paid") return t("order.paid");
  if (k === "canceled") return t("order.cancelled");
  if (k === "pending") return t("order.pending");
  return k;
}

function shippingStatusLabel(key: string) {
  const k = String(key || "").toLowerCase().replace(/-/g, "_");
  const path = `admin.orders.shipping_status_${k}`;
  const tr = t(path);
  return tr === path ? k : tr;
}

function openEdit(o: any) {
  const r = normalizeOrderRow({ ...o });
  editingId.value = String(r.id || r.order_id || "");
  let st = String(r.status || "pending").toLowerCase().replace("cancelled", "canceled");
  if (!PAYMENT_STATUS_VALUES.includes(st as (typeof PAYMENT_STATUS_VALUES)[number])) {
    st = "pending";
  }
  editForm.status = st;
  editForm.total_price = String(Number(r.total_price ?? r.total ?? 0) || "");
  editForm.slip_image_url = String(r.slip_image_url || "").trim();
  editForm.shipping_status = normalizeShippingStatus(r.shipping_status);
  editForm.tracking_number = String(r.tracking_number || "");
  editForm.courier_name = String(r.courier_name || "");
  editForm.shipping_receipt_number = String(r.shipping_receipt_number || "");
  editOpen.value = true;
}

async function saveEdit() {
  const id = editingId.value;
  const jwt = user.value?.token;
  if (!id || !jwt) return;
  const tp = Number(String(editForm.total_price).replace(/,/g, ""));
  if (!Number.isFinite(tp) || tp <= 0) {
    push.error(t("admin.orders.edit_fail"));
    return;
  }
  editBusy.value = true;
  try {
    const body: Record<string, unknown> = {
      status: editForm.status,
      total_price: tp,
      slip_image_url: editForm.slip_image_url.trim() || null,
      shipping_status: editForm.shipping_status,
      tracking_number: editForm.tracking_number.trim(),
      courier_name: editForm.courier_name.trim(),
      shipping_receipt_number: editForm.shipping_receipt_number.trim(),
    };
    await $fetch(endpoint(`admin/orders/${id}`), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body,
    });
    push.success(t("admin.orders.edit_ok"));
    editOpen.value = false;
    await fetchOrders();
  } catch (e: any) {
    const msg =
      e?.data?.error?.message || e?.data?.message || e?.message || t("admin.orders.edit_fail");
    push.error(msg);
  } finally {
    editBusy.value = false;
  }
}

onMounted(() => {
  checkAuth();
  fetchOrders();
});
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.orders.title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.orders.lead") }}
      </p>
    </div>

    <ListPaginationBar
      :page="orderPagination.page"
      :total-pages="orderPagination.total_pages"
      :total="orderPagination.total"
      :page-size="orderPagination.page_size"
      :loading="isLoading"
      :search="listSearch"
      @update:page="onOrderPage"
      @update:search="onOrderSearch"
    />

    <UCard>
      <div v-if="isLoading" class="py-12 text-center text-neutral-500">
        {{ t("general.loading") }}
      </div>
      <div v-else-if="error" class="py-8 text-center text-red-600 dark:text-red-400">
        {{ error }}
      </div>
      <div
        v-else-if="!orders.length && orderPagination.total === 0 && !listSearch"
        class="py-12 text-center text-neutral-500"
      >
        {{ t("admin.orders.empty") }}
      </div>
      <div
        v-else-if="!orders.length && listSearch"
        class="py-12 text-center text-neutral-500"
      >
        {{ t("admin.orders.empty_search") }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead>
            <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_id") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_buyer") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_status") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_total") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_date") }}</th>
              <th class="py-2 font-medium">{{ t("admin.orders.col_actions") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(o, i) in orders"
              :key="o.id || o.order_id || i"
              class="border-b border-neutral-100 dark:border-neutral-800"
            >
              <td class="py-3 pr-4 font-mono text-xs align-middle">
                {{ o.id ?? o.order_id ?? "—" }}
              </td>
              <td class="py-3 pr-4 text-neutral-600 dark:text-neutral-400 break-all max-w-[12rem] align-middle">
                {{ o.buyer_email ?? "—" }}
              </td>
              <td class="py-3 pr-4 capitalize align-middle">
                {{ o.status ?? o.order_status ?? "—" }}
              </td>
              <td class="py-3 pr-4 align-middle">
                {{ o.total_price ?? o.total ?? o.grand_total ?? "—" }}
              </td>
              <td class="py-3 pr-4 text-neutral-600 dark:text-neutral-400 align-middle">
                {{ formatDate(o.created_at || o.date_created || o.createdAt || "") }}
              </td>
              <td class="py-3 align-middle">
                <UButton size="sm" color="neutral" variant="soft" @click="openEdit(o)">
                  {{ t("admin.orders.edit") }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal
      v-model="editOpen"
      :ui="{
        overlay: { background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm' },
        background: 'bg-white dark:bg-neutral-900',
        width: 'w-full sm:max-w-lg',
        rounded: 'rounded-2xl',
      }"
    >
      <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
            {{ t("admin.orders.edit_title") }}
          </h2>
          <UButton color="neutral" variant="ghost" icon="i-heroicons-x-mark-20-solid" @click="editOpen = false" />
        </div>

        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          {{ t("admin.orders.edit_hint") }}
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_payment_status") }}
            </label>
            <select
              v-model="editForm.status"
              class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-white"
            >
              <option v-for="s in PAYMENT_STATUS_VALUES" :key="s" :value="s">
                {{ paymentStatusLabel(s) }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_total_price") }}
            </label>
            <UInput v-model="editForm.total_price" type="text" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_slip_url") }}
            </label>
            <UInput v-model="editForm.slip_image_url" type="text" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_shipping_status") }}
            </label>
            <select
              v-model="editForm.shipping_status"
              class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-white"
            >
              <option v-for="s in SHIP_STATUS_VALUES" :key="s" :value="s">
                {{ shippingStatusLabel(s) }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_tracking") }}
            </label>
            <UInput v-model="editForm.tracking_number" type="text" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_courier") }}
            </label>
            <UInput v-model="editForm.courier_name" type="text" class="w-full" />
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {{ t("admin.orders.form_receipt") }}
            </label>
            <UInput v-model="editForm.shipping_receipt_number" type="text" class="w-full" />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <UButton color="neutral" variant="soft" :disabled="editBusy" @click="editOpen = false">
            {{ t("admin.orders.cancel") }}
          </UButton>
          <UButton :loading="editBusy" @click="saveEdit">
            {{ t("admin.orders.save") }}
          </UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
