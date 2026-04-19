<script setup lang="ts">
import { push } from "notivue";

definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { user, checkAuth } = useAuth();
const { endpoint } = useCmsApi();

const PAGE = 25;

const activeTab = ref<"summary" | "ledger" | "withdrawals" | "audit">("summary");

const loading = ref(true);
const error = ref<string | null>(null);

const dashboard = ref<Record<string, unknown> | null>(null);

const ledgerRows = ref<any[]>([]);
const ledgerTotal = ref(0);
const ledgerPage = ref(1);
const ledgerType = ref("");
const ledgerSellerId = ref("");
const ledgerLoading = ref(false);

const wdRows = ref<any[]>([]);
const wdTotal = ref(0);
const wdPage = ref(1);
const wdStatus = ref("");
const wdLoading = ref(false);

const auditRows = ref<any[]>([]);
const auditTotal = ref(0);
const auditPage = ref(1);
const auditAction = ref("");
const auditEntityType = ref("");
const auditLoading = ref(false);

const detailOpen = ref(false);
const detailLoading = ref(false);
const detailWithdrawal = ref<any>(null);
const detailTxs = ref<any[]>([]);
const actionNotes = ref("");
const actionBusy = ref(false);

function pickInner(res: any) {
  if (res?.data != null && typeof res.data === "object") return res.data;
  return res;
}

function formatThb(n: unknown) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(x);
}

function formatDt(iso: unknown) {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function formatJson(obj: unknown) {
  try {
    return JSON.stringify(obj ?? null, null, 2);
  } catch {
    return String(obj);
  }
}

async function authFetch(path: string, opts: Record<string, unknown> = {}) {
  const jwt = user.value?.token;
  if (!jwt) throw new Error(String(t("auth.login_required")));
  const { headers: h, ...rest } = opts;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${jwt}`,
    ...(typeof h === "object" && h !== null ? (h as Record<string, string>) : {}),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return $fetch<any>(endpoint(path), { ...rest, headers } as any);
}

async function loadDashboard() {
  const res = await authFetch("admin/wallet/dashboard");
  dashboard.value = pickInner(res) as Record<string, unknown>;
}

async function loadLedger() {
  ledgerLoading.value = true;
  try {
    const offset = (ledgerPage.value - 1) * PAGE;
    const q: Record<string, string | number> = { limit: PAGE, offset };
    if (ledgerType.value) q.type = ledgerType.value;
    if (ledgerSellerId.value.trim()) q.seller_id = ledgerSellerId.value.trim();
    const res = await authFetch("admin/wallet/ledger", { query: q });
    const inner = pickInner(res) as any;
    ledgerRows.value = Array.isArray(inner?.entries) ? inner.entries : [];
    ledgerTotal.value = Number(inner?.pagination?.total ?? 0);
  } catch (e: any) {
    push.error(e?.message || t("admin.finance.load_failed"));
    ledgerRows.value = [];
    ledgerTotal.value = 0;
  } finally {
    ledgerLoading.value = false;
  }
}

async function loadWithdrawals() {
  wdLoading.value = true;
  try {
    const offset = (wdPage.value - 1) * PAGE;
    const q: Record<string, string | number> = { limit: PAGE, offset };
    if (wdStatus.value) q.status = wdStatus.value;
    const res = await authFetch("admin/withdrawals", { query: q });
    const inner = pickInner(res) as any;
    wdRows.value = Array.isArray(inner?.withdrawals) ? inner.withdrawals : [];
    wdTotal.value = Number(inner?.pagination?.total ?? 0);
  } catch (e: any) {
    push.error(e?.message || t("admin.finance.load_failed"));
    wdRows.value = [];
    wdTotal.value = 0;
  } finally {
    wdLoading.value = false;
  }
}

async function loadAudit() {
  auditLoading.value = true;
  try {
    const offset = (auditPage.value - 1) * PAGE;
    const q: Record<string, string | number> = { limit: PAGE, offset };
    if (auditAction.value.trim()) q.action = auditAction.value.trim();
    if (auditEntityType.value.trim()) q.entity_type = auditEntityType.value.trim();
    const res = await authFetch("admin/wallet/audit-log", { query: q });
    const inner = pickInner(res) as any;
    auditRows.value = Array.isArray(inner?.entries) ? inner.entries : [];
    auditTotal.value = Number(inner?.pagination?.total ?? 0);
  } catch (e: any) {
    push.error(e?.message || t("admin.finance.load_failed"));
    auditRows.value = [];
    auditTotal.value = 0;
  } finally {
    auditLoading.value = false;
  }
}

function ledgerTotalPages() {
  return Math.max(1, Math.ceil(ledgerTotal.value / PAGE));
}
function wdTotalPages() {
  return Math.max(1, Math.ceil(wdTotal.value / PAGE));
}
function auditTotalPages() {
  return Math.max(1, Math.ceil(auditTotal.value / PAGE));
}

async function openWithdrawalDetail(id: string) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailWithdrawal.value = null;
  detailTxs.value = [];
  actionNotes.value = "";
  try {
    const res = await authFetch(`admin/withdrawals/${id}`);
    const inner = pickInner(res) as any;
    detailWithdrawal.value = inner?.withdrawal ?? null;
    detailTxs.value = Array.isArray(inner?.related_transactions) ? inner.related_transactions : [];
  } catch (e: any) {
    push.error(e?.message || t("admin.finance.detail_failed"));
    detailOpen.value = false;
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  detailOpen.value = false;
}

async function postWithdrawalAction(
  pathSuffix: "approve" | "reject" | "mark-paid",
  withdrawalId: string
) {
  actionBusy.value = true;
  try {
    const body =
      pathSuffix === "mark-paid" ? {} : { admin_notes: actionNotes.value || null };
    await authFetch(`admin/withdrawals/${withdrawalId}/${pathSuffix}`, {
      method: "POST",
      body,
    });
    push.success(t("admin.finance.action_ok"));
    closeDetail();
    await loadWithdrawals();
    await loadLedger();
    await loadAudit();
    await loadDashboard();
  } catch (e: any) {
    const msg =
      e?.data?.error?.message || e?.data?.message || e?.message || t("admin.finance.action_failed");
    push.error(msg);
  } finally {
    actionBusy.value = false;
  }
}

watch(activeTab, async (tab: "summary" | "ledger" | "withdrawals" | "audit") => {
  if (tab === "ledger") await loadLedger();
  if (tab === "withdrawals") await loadWithdrawals();
  if (tab === "audit") await loadAudit();
});

watch([ledgerPage, ledgerType, ledgerSellerId], async () => {
  if (activeTab.value !== "ledger") return;
  await loadLedger();
});

watch([wdPage, wdStatus], async () => {
  if (activeTab.value !== "withdrawals") return;
  await loadWithdrawals();
});

watch([auditPage, auditAction, auditEntityType], async () => {
  if (activeTab.value !== "audit") return;
  await loadAudit();
});

onMounted(async () => {
  checkAuth();
  loading.value = true;
  error.value = null;
  try {
    await loadDashboard();
  } catch (e: any) {
    error.value = e?.message || t("admin.finance.load_failed");
  } finally {
    loading.value = false;
  }
});

function wdStatusLabel(s: string) {
  const k = String(s || "").toLowerCase();
  const map: Record<string, string> = {
    pending: "admin.finance.wd_pending",
    approved: "admin.finance.wd_approved",
    paid: "admin.finance.wd_paid",
    rejected: "admin.finance.wd_rejected",
  };
  return t(map[k] || "admin.finance.wd_unknown");
}

function ledgerTypeLabel(type: string) {
  const k = String(type || "").toLowerCase();
  const map: Record<string, string> = {
    escrow_in: "admin.finance.lt_escrow",
    release: "admin.finance.lt_release",
    withdraw: "admin.finance.lt_withdraw",
    refund: "admin.finance.lt_refund",
  };
  return t(map[k] || type || "—");
}

const tabBtn = (active: boolean) =>
  [
    "px-4 py-2 rounded-xl text-sm font-semibold transition",
    active
      ? "bg-alizarin-crimson-600 text-white"
      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-700",
  ].join(" ");

const byStatus = computed(() => {
  const d = dashboard.value?.withdrawals_by_status as Record<string, { count: number; total_amount: number }> | undefined;
  return d && typeof d === "object" ? d : {};
});

const platformBalances = computed(() => {
  const p = dashboard.value?.platform_balances as Record<string, number> | undefined;
  return p || {};
});

function applyLedgerFilters() {
  ledgerPage.value = 1;
  void loadLedger();
}

function applyAuditFilters() {
  auditPage.value = 1;
  void loadAudit();
}
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.finance.title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.finance.lead") }}
      </p>
    </div>

    <div v-if="loading" class="py-12 text-center text-neutral-500">
      {{ t("general.loading") }}
    </div>
    <div v-else-if="error" class="py-8 text-center text-red-600 dark:text-red-400">
      {{ error }}
    </div>
    <template v-else>
      <div class="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <button type="button" :class="tabBtn(activeTab === 'summary')" @click="activeTab = 'summary'">
          {{ t("admin.finance.tab_summary") }}
        </button>
        <button type="button" :class="tabBtn(activeTab === 'ledger')" @click="activeTab = 'ledger'">
          {{ t("admin.finance.tab_ledger") }}
        </button>
        <button type="button" :class="tabBtn(activeTab === 'withdrawals')" @click="activeTab = 'withdrawals'">
          {{ t("admin.finance.tab_withdrawals") }}
        </button>
        <button type="button" :class="tabBtn(activeTab === 'audit')" @click="activeTab = 'audit'">
          {{ t("admin.finance.tab_audit") }}
        </button>
      </div>

      <!-- Summary -->
      <div v-show="activeTab === 'summary'" class="space-y-4">
        <div class="grid sm:grid-cols-2 gap-4">
          <UCard>
            <p class="text-sm text-neutral-500">{{ t("admin.finance.sum_available") }}</p>
            <p class="text-2xl font-bold text-neutral-900 dark:text-white">
              {{ formatThb(platformBalances.sum_available) }}
            </p>
          </UCard>
          <UCard>
            <p class="text-sm text-neutral-500">{{ t("admin.finance.sum_escrow") }}</p>
            <p class="text-2xl font-bold text-neutral-900 dark:text-white">
              {{ formatThb(platformBalances.sum_escrow) }}
            </p>
          </UCard>
        </div>
        <UCard>
          <h3 class="font-semibold text-neutral-900 dark:text-white mb-3">
            {{ t("admin.finance.withdrawals_by_status") }}
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead>
                <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500">
                  <th class="py-2 pr-4">{{ t("admin.finance.col_status") }}</th>
                  <th class="py-2 pr-4">{{ t("admin.finance.col_count") }}</th>
                  <th class="py-2">{{ t("admin.finance.col_volume") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, st) in byStatus"
                  :key="st"
                  class="border-b border-neutral-100 dark:border-neutral-800"
                >
                  <td class="py-2 pr-4">{{ wdStatusLabel(String(st)) }}</td>
                  <td class="py-2 pr-4">{{ row?.count ?? 0 }}</td>
                  <td class="py-2">{{ formatThb(row?.total_amount) }}</td>
                </tr>
                <tr v-if="!Object.keys(byStatus).length">
                  <td colspan="3" class="py-4 text-neutral-500">{{ t("admin.finance.empty_status") }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>

      <!-- Ledger -->
      <div v-show="activeTab === 'ledger'" class="space-y-4">
        <UCard>
          <div class="flex flex-wrap gap-3 items-end mb-4">
            <UFormGroup :label="t('admin.finance.filter_type')" class="min-w-[160px]">
              <select
                v-model="ledgerType"
                class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="">{{ t("admin.finance.filter_all") }}</option>
                <option value="escrow_in">escrow_in</option>
                <option value="release">release</option>
                <option value="withdraw">withdraw</option>
                <option value="refund">refund</option>
              </select>
            </UFormGroup>
            <UFormGroup :label="t('admin.finance.filter_seller_id')" class="min-w-[220px] flex-1">
              <UInput v-model="ledgerSellerId" placeholder="uuid" class="font-mono text-xs" />
            </UFormGroup>
            <UButton color="neutral" variant="soft" @click="applyLedgerFilters">
              {{ t("admin.finance.apply_filters") }}
            </UButton>
          </div>
          <div v-if="ledgerLoading" class="py-8 text-center text-neutral-500">{{ t("general.loading") }}</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left min-w-[960px]">
              <thead>
                <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500">
                  <th class="py-2 pr-2">{{ t("admin.finance.col_time") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_type") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_amount") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_seller") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_buyer") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_order") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_order_total") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_pay_status") }}</th>
                  <th class="py-2">{{ t("admin.finance.col_meta") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in ledgerRows"
                  :key="r.id"
                  class="border-b border-neutral-100 dark:border-neutral-800 align-top"
                >
                  <td class="py-2 pr-2 whitespace-nowrap">{{ formatDt(r.created_at) }}</td>
                  <td class="py-2 pr-2">{{ ledgerTypeLabel(r.type) }}</td>
                  <td class="py-2 pr-2 font-medium">{{ formatThb(r.amount) }}</td>
                  <td class="py-2 pr-2">
                    <div class="max-w-[200px] truncate text-xs" :title="r.seller_email || ''">
                      {{ r.seller_email || "—" }}
                    </div>
                  </td>
                  <td class="py-2 pr-2">
                    <div class="max-w-[200px] truncate text-xs" :title="r.buyer_email || ''">
                      {{ r.buyer_email || "—" }}
                    </div>
                  </td>
                  <td class="py-2 pr-2 font-mono text-xs">{{ r.order_id ? String(r.order_id).slice(0, 8) + "…" : "—" }}</td>
                  <td class="py-2 pr-2">{{ r.order_total != null ? formatThb(r.order_total) : "—" }}</td>
                  <td class="py-2 pr-2 text-xs">{{ r.order_status || "—" }}</td>
                  <td class="py-2 max-w-[240px]">
                    <pre
                      class="text-[10px] leading-tight overflow-auto max-h-24 bg-neutral-100 dark:bg-neutral-900 rounded p-1"
                      >{{ formatJson(r.metadata) }}</pre
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!ledgerLoading && !ledgerRows.length" class="py-6 text-center text-neutral-500">
            {{ t("admin.finance.empty_ledger") }}
          </div>
          <div class="flex justify-between items-center mt-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <span class="text-xs text-neutral-500"
              >{{ t("admin.finance.page_of", { page: ledgerPage, total: ledgerTotalPages() }) }}</span
            >
            <div class="flex gap-2">
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :disabled="ledgerPage <= 1"
                @click="ledgerPage--"
              >
                {{ t("admin.finance.prev") }}
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :disabled="ledgerPage >= ledgerTotalPages()"
                @click="ledgerPage++"
              >
                {{ t("admin.finance.next") }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Withdrawals -->
      <div v-show="activeTab === 'withdrawals'" class="space-y-4">
        <UCard>
          <div class="flex flex-wrap gap-3 items-end mb-4">
            <UFormGroup :label="t('admin.finance.filter_status')" class="min-w-[160px]">
              <select
                v-model="wdStatus"
                class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="">{{ t("admin.finance.filter_all") }}</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="paid">paid</option>
                <option value="rejected">rejected</option>
              </select>
            </UFormGroup>
          </div>
          <div v-if="wdLoading" class="py-8 text-center text-neutral-500">{{ t("general.loading") }}</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left min-w-[720px]">
              <thead>
                <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500">
                  <th class="py-2 pr-2">{{ t("admin.finance.col_time") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_status") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_seller") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_gross") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_fee") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_net") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_bank") }}</th>
                  <th class="py-2">{{ t("admin.finance.col_actions") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="w in wdRows"
                  :key="w.id"
                  class="border-b border-neutral-100 dark:border-neutral-800"
                >
                  <td class="py-2 pr-2 whitespace-nowrap">{{ formatDt(w.requested_at) }}</td>
                  <td class="py-2 pr-2">{{ wdStatusLabel(w.status) }}</td>
                  <td class="py-2 pr-2 text-xs max-w-[180px] truncate" :title="w.seller_email">
                    {{ w.seller_email || "—" }}
                  </td>
                  <td class="py-2 pr-2">{{ formatThb(w.amount) }}</td>
                  <td class="py-2 pr-2">{{ formatThb(w.withdrawal_fee_amount) }}</td>
                  <td class="py-2 pr-2">{{ formatThb(w.net_payout_amount) }}</td>
                  <td class="py-2 pr-2 text-xs">{{ w.payout_bank_code || "—" }}</td>
                  <td class="py-2">
                    <UButton size="xs" variant="soft" @click="openWithdrawalDetail(w.id)">
                      {{ t("admin.finance.btn_detail") }}
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!wdLoading && !wdRows.length" class="py-6 text-center text-neutral-500">
            {{ t("admin.finance.empty_wd") }}
          </div>
          <div class="flex justify-between items-center mt-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <span class="text-xs text-neutral-500"
              >{{ t("admin.finance.page_of", { page: wdPage, total: wdTotalPages() }) }}</span
            >
            <div class="flex gap-2">
              <UButton size="sm" color="neutral" variant="soft" :disabled="wdPage <= 1" @click="wdPage--">
                {{ t("admin.finance.prev") }}
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :disabled="wdPage >= wdTotalPages()"
                @click="wdPage++"
              >
                {{ t("admin.finance.next") }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Audit -->
      <div v-show="activeTab === 'audit'" class="space-y-4">
        <UCard>
          <div class="flex flex-wrap gap-3 items-end mb-4">
            <UFormGroup :label="t('admin.finance.filter_action')" class="min-w-[180px]">
              <UInput v-model="auditAction" placeholder="escrow_in" />
            </UFormGroup>
            <UFormGroup :label="t('admin.finance.filter_entity')" class="min-w-[160px]">
              <UInput v-model="auditEntityType" placeholder="order" />
            </UFormGroup>
            <UButton color="neutral" variant="soft" @click="applyAuditFilters">
              {{ t("admin.finance.apply_filters") }}
            </UButton>
          </div>
          <div v-if="auditLoading" class="py-8 text-center text-neutral-500">{{ t("general.loading") }}</div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm text-left min-w-[800px]">
              <thead>
                <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500">
                  <th class="py-2 pr-2">{{ t("admin.finance.col_time") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_action") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_entity") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_entity_id") }}</th>
                  <th class="py-2 pr-2">{{ t("admin.finance.col_actor") }}</th>
                  <th class="py-2">{{ t("admin.finance.col_details") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="a in auditRows"
                  :key="a.id"
                  class="border-b border-neutral-100 dark:border-neutral-800 align-top"
                >
                  <td class="py-2 pr-2 whitespace-nowrap">{{ formatDt(a.created_at) }}</td>
                  <td class="py-2 pr-2 font-mono text-xs">{{ a.action }}</td>
                  <td class="py-2 pr-2">{{ a.entity_type }}</td>
                  <td class="py-2 pr-2 font-mono text-xs">{{ a.entity_id ? String(a.entity_id).slice(0, 8) + "…" : "—" }}</td>
                  <td class="py-2 pr-2 text-xs max-w-[160px] truncate" :title="a.actor_email || ''">
                    {{ a.actor_email || "—" }}
                  </td>
                  <td class="py-2 max-w-[320px]">
                    <pre
                      class="text-[10px] leading-tight overflow-auto max-h-28 bg-neutral-100 dark:bg-neutral-900 rounded p-1"
                      >{{ formatJson(a.details) }}</pre
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="!auditLoading && !auditRows.length" class="py-6 text-center text-neutral-500">
            {{ t("admin.finance.empty_audit") }}
          </div>
          <div class="flex justify-between items-center mt-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <span class="text-xs text-neutral-500"
              >{{ t("admin.finance.page_of", { page: auditPage, total: auditTotalPages() }) }}</span
            >
            <div class="flex gap-2">
              <UButton size="sm" color="neutral" variant="soft" :disabled="auditPage <= 1" @click="auditPage--">
                {{ t("admin.finance.prev") }}
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :disabled="auditPage >= auditTotalPages()"
                @click="auditPage++"
              >
                {{ t("admin.finance.next") }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </template>

    <UModal
      v-model="detailOpen"
      :ui="{
        overlay: { background: 'bg-black/50 dark:bg-black/70 backdrop-blur-sm' },
        background: 'bg-white dark:bg-neutral-900',
        width: 'w-full sm:max-w-lg',
        rounded: 'rounded-2xl',
      }"
    >
      <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          {{ t("admin.finance.detail_title") }}
        </h3>
        <div v-if="detailLoading" class="py-8 text-center text-neutral-500">{{ t("general.loading") }}</div>
        <template v-else-if="detailWithdrawal">
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-neutral-500">{{ t("admin.finance.col_status") }}</dt>
            <dd>{{ wdStatusLabel(detailWithdrawal.status) }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.col_seller") }}</dt>
            <dd class="break-all">{{ detailWithdrawal.seller_email }} ({{ detailWithdrawal.seller_id }})</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.col_gross") }}</dt>
            <dd>{{ formatThb(detailWithdrawal.amount) }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.col_fee") }}</dt>
            <dd>{{ formatThb(detailWithdrawal.withdrawal_fee_amount) }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.col_net") }}</dt>
            <dd>{{ formatThb(detailWithdrawal.net_payout_amount) }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.col_bank") }}</dt>
            <dd>{{ detailWithdrawal.payout_bank_code }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.payout_name") }}</dt>
            <dd>{{ detailWithdrawal.payout_account_name }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.payout_account_full") }}</dt>
            <dd class="font-mono text-xs break-all">{{ detailWithdrawal.payout_account_number || "—" }}</dd>
            <dt class="text-neutral-500">{{ t("admin.finance.admin_notes") }}</dt>
            <dd class="sm:col-span-2 whitespace-pre-wrap">{{ detailWithdrawal.admin_notes || "—" }}</dd>
          </dl>

          <div v-if="detailTxs.length">
            <h4 class="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mt-4">
              {{ t("admin.finance.related_tx") }}
            </h4>
            <ul class="mt-2 space-y-1 text-xs font-mono text-neutral-600 dark:text-neutral-400">
              <li v-for="tx in detailTxs" :key="tx.id">
                {{ tx.type }} · {{ formatThb(tx.amount) }} · {{ formatDt(tx.created_at) }}
              </li>
            </ul>
          </div>

          <UFormGroup v-if="detailWithdrawal.status === 'pending'" :label="t('admin.finance.notes_optional')">
            <textarea
              v-model="actionNotes"
              rows="3"
              class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
            />
          </UFormGroup>

          <div class="flex flex-wrap gap-2 justify-end pt-2">
            <UButton variant="ghost" color="neutral" @click="closeDetail">{{ t("admin.users.cancel") }}</UButton>
            <template v-if="detailWithdrawal.status === 'pending'">
              <UButton
                color="green"
                :loading="actionBusy"
                @click="postWithdrawalAction('approve', detailWithdrawal.id)"
              >
                {{ t("admin.finance.btn_approve") }}
              </UButton>
              <UButton
                color="red"
                variant="soft"
                :loading="actionBusy"
                @click="postWithdrawalAction('reject', detailWithdrawal.id)"
              >
                {{ t("admin.finance.btn_reject") }}
              </UButton>
            </template>
            <UButton
              v-if="detailWithdrawal.status === 'approved'"
              color="primary"
              :loading="actionBusy"
              @click="postWithdrawalAction('mark-paid', detailWithdrawal.id)"
            >
              {{ t("admin.finance.btn_mark_paid") }}
            </UButton>
          </div>
        </template>
      </div>
    </UModal>
  </div>
</template>
