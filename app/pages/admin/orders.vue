<script setup lang="ts">
import { push } from "notivue";
import { buildShipmentTimelineSteps } from "~/utils/shipmentTimeline";
import { pickPagination, paginationQuery } from "~/utils/paginationResponse";
import ShipmentTimeline from "~/components/ShipmentTimeline.vue";
import StorefrontImg from "~/components/StorefrontImg.vue";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { user, checkAuth } = useAuth();
const { adminFetch } = useAdminFetch();
const { resolveMediaUrl } = useStorefrontCatalog();
const { paymentLabel, paymentColorClass, customerPaymentUiKey } =
  useCustomerPaymentStatus();

const SHIP_STATUS_VALUES = [
  "pending",
  "preparing",
  "shipped",
  "out_for_delivery",
  "delivered",
] as const;

const isLoading = ref(true);
const orders = ref<any[]>([]);
const error = ref<string | null>(null);
const expandedId = ref<string | null>(null);
const savingId = ref<string | null>(null);
const markingPaidId = ref<string | null>(null);
/** แบบร่างแก้จัดส่งต่อออเดอร์ — key = order.id */
const adminDrafts = ref<Record<string, any>>({});

const ORDER_PAGE_SIZE = 20;
const listPage = ref(1);
const listSearch = ref("");
const orderPagination = ref({
  page: 1,
  page_size: ORDER_PAGE_SIZE,
  total: 0,
  total_pages: 0,
});

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
  o.fulfillment_updated_at = o.fulfillment_updated_at ?? null;
  o.slip_snapshots = Array.isArray(o.slip_snapshots) ? o.slip_snapshots : [];
  if (o.status != null) o.status = String(o.status);
  if (o.order_status != null) o.order_status = String(o.order_status);
  o.is_paid = customerPaymentUiKey(o) === "paid";
  return o;
}

function resolveSlipHref(path: string): string {
  if (!path || typeof path !== "string") return "";
  const p = path.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return resolveMediaUrl(p) || p;
}

function isPdfSlip(path: string): boolean {
  if (!path) return false;
  return /\.pdf(\?|#|$)/i.test(path);
}

/** แสดงในคำสั่งซื้อ: ประวัติสลิป หรือ slip_image_url เดิม */
function slipGalleryForOrder(order: any) {
  const snaps = Array.isArray(order.slip_snapshots) ? order.slip_snapshots : [];
  if (snaps.length) {
    return snaps.map((s: any) => ({
      key: String(s.id || s.created_at || Math.random()),
      url: s.image_url ? String(s.image_url).trim() : "",
      created_at: s.created_at || null,
    }));
  }
  const legacy = order.slip_image_url ? String(order.slip_image_url).trim() : "";
  if (legacy) {
    return [
      {
        key: "legacy-slip",
        url: legacy,
        created_at: order.created_at || order.date_created || null,
      },
    ];
  }
  return [];
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

/** Express sendSuccess wraps payload in `data`; mock may return flat */
function pickOrdersPayload(res: any): any[] {
  const inner = res?.data && typeof res.data === "object" ? res.data : res;
  if (Array.isArray(inner?.orders)) return inner.orders;
  if (Array.isArray(res?.orders)) return res.orders;
  return [];
}

function draftAdmin(order: any) {
  const id = order.id;
  if (!adminDrafts.value[id]) {
    adminDrafts.value[id] = reactive({
      tracking_number: String(order.tracking_number || ""),
      shipping_status: normalizeShippingStatus(order.shipping_status),
      courier_name: String(order.courier_name || ""),
    });
  }
  return adminDrafts.value[id];
}

function shipmentStepsForOrder(order: any) {
  return buildShipmentTimelineSteps({
    status: order.status,
    date_created: order.date_created || order.created_at,
    created_at: order.created_at || order.date_created,
    shipping_status: normalizeShippingStatus(order.shipping_status),
    fulfillment_updated_at: order.fulfillment_updated_at,
  });
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
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
  expandedId.value = null;
  adminDrafts.value = {};
  try {
    const body = (await adminFetch("seller-orders", {
      query: paginationQuery(listPage.value, listSearch.value, ORDER_PAGE_SIZE),
    })) as any;
    if (body && body.success !== false) {
      orders.value = pickOrdersPayload(body).map(normalizeOrderRow);
      const pg = pickPagination(body);
      if (pg) {
        orderPagination.value = pg;
      } else {
        orderPagination.value = {
          page: listPage.value,
          page_size: ORDER_PAGE_SIZE,
          total: orders.value.length,
          total_pages: orders.value.length ? 1 : 0,
        };
      }
    } else {
      error.value = body?.error || body?.message || t("seller_orders.error_loading");
      orders.value = [];
      orderPagination.value = {
        page: 1,
        page_size: ORDER_PAGE_SIZE,
        total: 0,
        total_pages: 0,
      };
    }
  } catch (e: any) {
    error.value = e?.message || t("seller_orders.error_loading");
    orders.value = [];
    orderPagination.value = {
      page: 1,
      page_size: ORDER_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    };
  } finally {
    isLoading.value = false;
  }
}

useRefetchWhenTabVisible(() => {
  if (user.value?.token) void fetchOrders();
});

async function saveAdminFulfillment(order: any) {
  const jwt = user.value?.token;
  if (!jwt) {
    push.error(t("auth.login_required"));
    return;
  }
  const d = draftAdmin(order);
  savingId.value = order.id;
  try {
    const inner = (await adminFetch(`seller-orders/${order.id}/fulfillment`, {
      method: "PATCH",
      body: {
        tracking_number: d.tracking_number || "",
        shipping_status: d.shipping_status,
        courier_name: d.courier_name || "",
      },
    })) as any;
    const updated = inner?.order;
    if (updated) {
      const ix = orders.value.findIndex((row: any) => row.id === order.id);
      if (ix >= 0) {
        const prev = orders.value[ix];
        orders.value[ix] = normalizeOrderRow({
          ...prev,
          ...updated,
          line_items: prev.line_items,
          slip_snapshots: prev.slip_snapshots,
        });
      }
      delete adminDrafts.value[order.id];
      push.success(t("seller_orders.fulfillment_saved"));
    }
  } catch (e: any) {
    push.error(
      e?.data?.error?.message ||
        e?.data?.message ||
        e?.message ||
        t("seller_orders.fulfillment_save_error")
    );
  } finally {
    savingId.value = null;
  }
}

function showAdminMarkPaid(order: any) {
  const s = String(order?.status ?? "").toLowerCase();
  return s === "pending" || customerPaymentUiKey(order) === "awaiting_payment";
}

async function markPaidAdmin(order: any) {
  const id = String(order.id || order.order_id || "").trim();
  if (!id) return;
  if (!import.meta.client) return;
  if (!window.confirm(String(t("admin.orders.mark_paid_confirm")))) return;
  markingPaidId.value = id;
  try {
    await adminFetch(`admin/orders/${encodeURIComponent(id)}/mark-paid`, {
      method: "POST",
      body: {},
    });
    push.success(t("admin.orders.mark_paid_ok"));
    await fetchOrders();
  } catch (e: any) {
    push.error(
      e?.data?.error?.message ||
        e?.data?.message ||
        e?.message ||
        t("admin.orders.mark_paid_fail")
    );
  } finally {
    markingPaidId.value = null;
  }
}

onMounted(() => {
  checkAuth();
  fetchOrders();
});
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
          {{ t("admin.orders.title") }}
        </h1>
        <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
          {{ t("admin.orders.lead") }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-heroicons-arrow-path"
        @click="fetchOrders"
      >
        {{ t("common.reload") }}
      </UButton>
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
      <div v-else-if="!orders.length" class="py-12 text-center text-neutral-500">
        {{
          listSearch.trim()
            ? t("admin.orders.empty_search")
            : t("admin.orders.empty")
        }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead>
            <tr
              class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400"
            >
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_id") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_buyer") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_payment_status") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_total") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_date") }}</th>
              <th class="py-2 font-medium text-right">{{ t("admin.orders.col_fulfillment") }}</th>
            </tr>
          </thead>
          <tbody
            v-for="(o, i) in orders"
            :key="`ord-${o.id || o.order_id || i}`"
          >
            <tr class="border-b border-neutral-100 dark:border-neutral-800">
              <td class="py-3 pr-4 font-mono text-xs align-top">
                {{ o.id ?? o.order_id ?? "—" }}
              </td>
              <td
                class="py-3 pr-4 text-neutral-600 dark:text-neutral-400 break-all max-w-[12rem] align-top"
              >
                {{ o.buyer_email ?? "—" }}
              </td>
              <td class="py-3 pr-4 align-top">
                <span
                  :class="[
                    'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize',
                    paymentColorClass(o),
                  ]"
                >
                  {{ paymentLabel(o) }}
                </span>
                <p
                  class="mt-1 text-[10px] font-mono text-neutral-500 dark:text-neutral-500 break-all max-w-[14rem]"
                >
                  {{ o.status ?? o.order_status ?? "—" }}
                </p>
              </td>
              <td class="py-3 pr-4 align-top">
                {{ o.total_price ?? o.total ?? o.grand_total ?? "—" }}
              </td>
              <td class="py-3 pr-4 text-neutral-600 dark:text-neutral-400 align-top">
                {{ formatDate(o.created_at || o.date_created || o.createdAt || "") }}
              </td>
              <td class="py-3 text-right align-top">
                <div class="flex flex-col items-end gap-2">
                  <UButton
                    v-if="showAdminMarkPaid(o)"
                    size="xs"
                    color="success"
                    variant="soft"
                    :loading="markingPaidId === String(o.id || o.order_id || '')"
                    @click="markPaidAdmin(o)"
                  >
                    {{ t("admin.orders.mark_paid") }}
                  </UButton>
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    @click="toggleExpand(String(o.id || o.order_id || ''))"
                  >
                    {{
                      expandedId === String(o.id || o.order_id)
                        ? t("admin.orders.fulfillment_close")
                        : t("admin.orders.fulfillment_open")
                    }}
                  </UButton>
                </div>
              </td>
            </tr>
            <tr
              v-if="expandedId === String(o.id || o.order_id)"
              class="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/40"
            >
              <td colspan="6" class="p-4 sm:p-5">
                  <div class="max-w-2xl space-y-4">
                    <div
                      class="rounded-xl border border-amber-200/90 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 p-4 space-y-3"
                    >
                      <p
                        class="text-sm font-semibold text-amber-950 dark:text-amber-100"
                      >
                        {{ t("admin.orders.slip_section") }}
                      </p>
                      <div
                        v-if="slipGalleryForOrder(o).length"
                        class="flex flex-wrap gap-4"
                      >
                        <div
                          v-for="item in slipGalleryForOrder(o)"
                          :key="item.key"
                          class="rounded-lg border border-amber-200/80 dark:border-amber-900/40 bg-white/90 dark:bg-neutral-900/60 p-3 max-w-[min(100%,280px)]"
                        >
                          <p
                            v-if="item.created_at"
                            class="text-[11px] text-neutral-500 dark:text-neutral-400 mb-2"
                          >
                            {{ formatDate(String(item.created_at)) }}
                          </p>
                          <template v-if="item.url">
                            <a
                              v-if="isPdfSlip(item.url)"
                              :href="resolveSlipHref(item.url)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="text-sm font-medium text-alizarin-crimson-600 dark:text-alizarin-crimson-400 underline"
                            >
                              {{ t("admin.orders.slip_open_pdf") }}
                            </a>
                            <a
                              v-else
                              :href="resolveSlipHref(item.url)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="block"
                            >
                              <StorefrontImg
                                :src="resolveSlipHref(item.url)"
                                :alt="t('admin.orders.slip_section')"
                                class="max-h-48 w-auto rounded-md object-contain border border-neutral-200 dark:border-neutral-700"
                              />
                            </a>
                          </template>
                          <p
                            v-else
                            class="text-xs text-neutral-500 dark:text-neutral-400 italic"
                          >
                            {{ t("admin.orders.slip_no_image") }}
                          </p>
                        </div>
                      </div>
                      <p
                        v-else
                        class="text-xs text-neutral-500 dark:text-neutral-400"
                      >
                        {{ t("admin.orders.slip_empty") }}
                      </p>
                    </div>

                    <p class="text-sm font-semibold text-teal-900 dark:text-teal-100">
                      {{ t("seller_orders.fulfillment_section") }}
                    </p>
                    <ShipmentTimeline :steps="shipmentStepsForOrder(o)" />
                    <div class="grid gap-3 sm:grid-cols-2">
                      <div class="sm:col-span-2">
                        <label
                          class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                          :for="`admin-ship-status-${o.id}`"
                        >
                          {{ t("admin.orders.fulfillment_shipping_status") }}
                        </label>
                        <select
                          :id="`admin-ship-status-${o.id}`"
                          v-model="draftAdmin(o).shipping_status"
                          class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white"
                        >
                          <option
                            v-for="v in SHIP_STATUS_VALUES"
                            :key="v"
                            :value="v"
                          >
                            {{ t(`admin.orders.shipping_status_${v}`) }}
                          </option>
                        </select>
                      </div>
                      <div class="sm:col-span-2">
                        <label
                          class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                          :for="`admin-tracking-${o.id}`"
                        >
                          {{ t("order.tracking_number_label") }}
                        </label>
                        <input
                          :id="`admin-tracking-${o.id}`"
                          v-model="draftAdmin(o).tracking_number"
                          type="text"
                          autocomplete="off"
                          class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white"
                          :placeholder="t('seller_orders.tracking_placeholder')"
                        />
                      </div>
                      <div class="sm:col-span-2">
                        <label
                          class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1"
                          :for="`admin-courier-${o.id}`"
                        >
                          {{ t("seller_orders.courier_name") }}
                        </label>
                        <input
                          :id="`admin-courier-${o.id}`"
                          v-model="draftAdmin(o).courier_name"
                          type="text"
                          autocomplete="off"
                          class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-white"
                          :placeholder="t('seller_orders.courier_placeholder')"
                        />
                      </div>
                      <div class="sm:col-span-2 flex flex-wrap items-center gap-3">
                        <UButton
                          color="red"
                          :loading="savingId === o.id"
                          @click="saveAdminFulfillment(o)"
                        >
                          {{ t("seller_orders.save_fulfillment") }}
                        </UButton>
                        <span
                          v-if="o.fulfillment_updated_at"
                          class="text-xs text-neutral-500 dark:text-neutral-400"
                        >
                          {{ t("seller_orders.fulfillment_updated_at") }}
                          {{ formatDate(o.fulfillment_updated_at) }}
                        </span>
                      </div>
                    </div>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">
                      {{ t("admin.orders.fulfillment_hint") }}
                    </p>
                  </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
