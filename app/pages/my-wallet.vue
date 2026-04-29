<!-- app/pages/my-wallet.vue — กระเป๋าเงินผู้ซื้อ + ขอคืนเงิน -->
<script setup>
definePageMeta({ middleware: "auth", ssr: false });

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();
const localePath = useLocalePath();
const { endpoint, hasRemoteApi } = useCmsApi();
const { t, locale } = useI18n();

/* ─── helpers ─────────────────────────────── */
const isThaiLocale = computed(() =>
  String(locale.value || "").toLowerCase().startsWith("th")
);
function cmsPath(rel) {
  return hasRemoteApi ? endpoint(rel) : `/api/${rel}`;
}
function unwrapApi(res) {
  if (res?.success === true && res.data != null && typeof res.data === "object") return res.data;
  return res;
}
function apiErr(e) {
  const d = e?.data;
  return d?.error?.message || d?.message || e?.message || "";
}
function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat(isThaiLocale.value ? "th-TH" : "en-GB", {
    style: "currency", currency: "THB",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(x);
}
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return new Intl.DateTimeFormat(isThaiLocale.value ? "th-TH" : "en-GB", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}
function shortId(id) {
  return String(id || "").replace(/-/g, "").slice(0, 10).toUpperCase();
}

/* ─── state ───────────────────────────────── */
const isLoading    = ref(true);
const isLoadingMore = ref(false);
const pageError    = ref(null);

const wallet       = ref(null);
const transactions = ref([]);
const txOffset     = ref(0);
const txPagination = ref(null);
const TX_PAGE = 20;

const eligibleOrders = ref([]);
const myRequests     = ref([]);

/* modal state */
const showModal    = ref(false);
const modalOrder   = ref(null);
const modalReason  = ref("product_defect");
const modalNote    = ref("");
const submitting   = ref(false);
const submitError  = ref("");
const submitSuccess = ref("");

/* toast helper */
async function toast(msg, type = "success") {
  try {
    const { push } = await import("notivue");
    push[type]?.(String(msg)) ?? push.success(String(msg));
  } catch { /* notivue optional */ }
}

/* ─── loaders ─────────────────────────────── */
async function headers() {
  const token = user.value?.token;
  if (!token) throw new Error(t("bwallet.error_no_token"));
  return { Authorization: `Bearer ${token}` };
}

async function loadWallet() {
  const h = await headers();
  const raw = await $fetch(cmsPath("buyer-wallet"), { headers: h });
  const body = unwrapApi(raw);
  wallet.value = body?.wallet ?? null;
  transactions.value = Array.isArray(body?.transactions) ? body.transactions : [];
  txOffset.value = transactions.value.length;
}

async function loadEligibleOrders() {
  try {
    const h = await headers();
    const raw = await $fetch(cmsPath("buyer-wallet/eligible-orders"), { headers: h });
    eligibleOrders.value = unwrapApi(raw)?.orders ?? [];
  } catch { eligibleOrders.value = []; }
}

async function loadMyRequests() {
  try {
    const h = await headers();
    const raw = await $fetch(cmsPath("buyer-wallet/refund-requests"), { headers: h });
    myRequests.value = unwrapApi(raw)?.requests ?? [];
  } catch { myRequests.value = []; }
}

async function loadMoreTx() {
  isLoadingMore.value = true;
  try {
    const h = await headers();
    const raw = await $fetch(cmsPath("buyer-wallet/transactions"), {
      headers: h, query: { limit: TX_PAGE, offset: txOffset.value },
    });
    const body = unwrapApi(raw);
    const rows = Array.isArray(body?.transactions) ? body.transactions : [];
    txPagination.value = body?.pagination ?? null;
    transactions.value = [...transactions.value, ...rows];
    txOffset.value += rows.length;
  } catch (e) { pageError.value = apiErr(e); }
  finally { isLoadingMore.value = false; }
}

const hasMoreTx = computed(() => {
  if (!txPagination.value) return false;
  return txOffset.value < (txPagination.value.total ?? 0);
});

async function refresh() {
  isLoading.value = true;
  pageError.value = null;
  transactions.value = [];
  txOffset.value = 0;
  txPagination.value = null;
  try {
    await Promise.all([loadWallet(), loadEligibleOrders(), loadMyRequests()]);
  } catch (e) {
    pageError.value = apiErr(e) || t("bwallet.error_load");
  } finally {
    isLoading.value = false;
  }
}

/* ─── modal ───────────────────────────────── */
function openModal(order) {
  modalOrder.value  = order;
  modalReason.value = "product_defect";
  modalNote.value   = "";
  submitError.value = "";
  submitSuccess.value = "";
  showModal.value   = true;
}

function closeModal() {
  showModal.value = false;
  modalOrder.value = null;
}

async function submitRequest() {
  submitError.value = "";
  submitSuccess.value = "";
  if (!modalOrder.value) return;
  submitting.value = true;
  try {
    const h = await headers();
    await $fetch(cmsPath("buyer-wallet/refund-requests"), {
      method: "POST", headers: h,
      body: {
        order_id: modalOrder.value.id,
        reason: modalReason.value,
        note: modalNote.value.trim() || undefined,
      },
    });
    submitSuccess.value = t("bwallet.success_submitted");
    await toast(t("bwallet.success_submitted"));
    closeModal();
    await Promise.all([loadEligibleOrders(), loadMyRequests()]);
  } catch (e) {
    submitError.value = apiErr(e) || t("bwallet.err_request");
  } finally {
    submitting.value = false;
  }
}

/* ─── tx display helpers ──────────────────── */
function txTypeLabel(type, source) {
  const ty = String(type || "").toLowerCase();
  const so = String(source || "").toLowerCase();
  if (ty === "credit" && so === "refund")       return t("bwallet.tx_refund");
  if (ty === "debit"  && so === "purchase")      return t("bwallet.tx_purchase");
  if (ty === "credit" && so === "admin_credit")  return t("bwallet.tx_admin_credit");
  if (ty === "debit"  && so === "admin_debit")   return t("bwallet.tx_admin_debit");
  return ty === "credit" ? t("bwallet.tx_credit") : t("bwallet.tx_debit");
}
function txBadgeClass(type) {
  return String(type || "").toLowerCase() === "credit"
    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
    : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300";
}

/* ─── refund request display ──────────────── */
function reqStatusLabel(status) {
  const map = { pending: "req_status_pending", approved: "req_status_approved", rejected: "req_status_rejected" };
  return t(`bwallet.${map[status] ?? "req_status_pending"}`);
}
function reqStatusClass(status) {
  if (status === "approved") return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
  if (status === "rejected") return "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400";
  return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
}
function reqReasonLabel(reason) {
  if (reason === "product_defect") return t("bwallet.req_reason_product_defect");
  if (reason === "not_shipped_3_days") return t("bwallet.req_reason_not_shipped");
  return reason;
}

/* ─── mount ───────────────────────────────── */
onMounted(async () => {
  checkAuth();
  await nextTick();
  if (!isAuthenticated.value || !user.value) {
    router.push(localePath("/login"));
    return;
  }
  await refresh();
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-black">
    <ClientOnly>

      <!-- Loading -->
      <template v-if="isLoading">
        <div class="flex items-center justify-center min-h-[60vh]">
          <div class="text-center">
            <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-8 h-8 mb-3 text-neutral-400 dark:text-neutral-600 mx-auto" />
            <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ t("bwallet.loading") }}</p>
          </div>
        </div>
      </template>

      <!-- Error -->
      <template v-else-if="pageError">
        <div class="max-w-3xl mx-auto p-6">
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
            <p class="text-red-600 dark:text-red-400 mb-4">{{ pageError }}</p>
            <button type="button"
              class="px-6 py-2.5 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold text-sm hover:bg-alizarin-crimson-700 transition"
              @click="refresh">{{ t("bwallet.retry") }}</button>
          </div>
        </div>
      </template>

      <!-- Content -->
      <template v-else>
        <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">

          <!-- ── Header ── -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                {{ t("bwallet.title") }}
              </h1>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {{ t("bwallet.subtitle") }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink :to="localePath('/my-orders')"
                class="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700 transition">
                {{ t("bwallet.my_orders") }}
              </NuxtLink>
              <button type="button"
                class="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700 transition"
                @click="refresh">{{ t("bwallet.refresh") }}</button>
            </div>
          </div>

          <!-- ── Balance Card ── -->
          <div class="rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30">
            <p class="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">
              {{ t("bwallet.balance_label") }}
            </p>
            <p class="text-4xl font-bold text-black dark:text-white">
              {{ formatMoney(wallet?.balance ?? 0) }}
            </p>
            <p v-if="wallet?.updated_at" class="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              {{ t("bwallet.updated_at") }}: {{ formatDate(wallet.updated_at) }}
            </p>
          </div>

          <!-- ── Request Refund ── -->
          <div class="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20 overflow-hidden">
            <div class="p-5 border-b border-neutral-100 dark:border-neutral-800">
              <h2 class="text-base font-semibold text-black dark:text-white">
                {{ t("bwallet.request_refund_title") }}
              </h2>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {{ t("bwallet.request_refund_subtitle") }}
              </p>
            </div>

            <div class="p-5">
              <p v-if="!eligibleOrders.length" class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ t("bwallet.no_eligible_orders") }}
              </p>

              <div v-else class="space-y-3">
                <div v-for="order in eligibleOrders" :key="order.id"
                  class="flex items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                  <div class="min-w-0">
                    <p class="font-mono text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      #{{ shortId(order.id) }}
                    </p>
                    <p class="text-sm font-bold text-black dark:text-white">
                      {{ formatMoney(order.total_price) }}
                    </p>
                    <p class="text-xs text-neutral-400 dark:text-neutral-500">
                      {{ formatDate(order.paid_at ?? order.created_at) }}
                    </p>
                  </div>
                  <button type="button"
                    class="shrink-0 px-4 py-2 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white text-xs font-semibold rounded-xl hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition"
                    @click="openModal(order)">
                    {{ t("bwallet.btn_request") }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── My Refund Requests ── -->
          <div class="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20 overflow-hidden">
            <div class="p-5 border-b border-neutral-100 dark:border-neutral-800">
              <h2 class="text-base font-semibold text-black dark:text-white">
                {{ t("bwallet.my_requests_title") }}
              </h2>
            </div>

            <div class="p-5">
              <p v-if="!myRequests.length" class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ t("bwallet.no_requests") }}
              </p>

              <div v-else class="space-y-3">
                <div v-for="req in myRequests" :key="req.id"
                  class="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="space-y-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold" :class="reqStatusClass(req.status)">
                          {{ reqStatusLabel(req.status) }}
                        </span>
                        <span class="text-xs text-neutral-500 dark:text-neutral-400">
                          {{ reqReasonLabel(req.reason) }}
                        </span>
                      </div>
                      <p class="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                        {{ t("bwallet.modal_order") }}: #{{ shortId(req.order_id) }}
                      </p>
                      <p v-if="req.note" class="text-xs text-neutral-500 dark:text-neutral-400 italic">
                        "{{ req.note }}"
                      </p>
                      <p class="text-xs text-neutral-400 dark:text-neutral-500">
                        {{ formatDate(req.created_at) }}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-bold text-black dark:text-white">
                        {{ formatMoney(req.order_amount) }}
                      </p>
                    </div>
                  </div>

                  <!-- Admin reply -->
                  <div v-if="req.admin_note" class="mt-3 px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-0.5">
                      {{ t("bwallet.req_admin_note") }}:
                    </p>
                    <p class="text-xs text-neutral-700 dark:text-neutral-300">{{ req.admin_note }}</p>
                    <p v-if="req.reviewed_at" class="text-xs text-neutral-400 mt-1">
                      {{ t("bwallet.req_reviewed_at") }}: {{ formatDate(req.reviewed_at) }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Transaction History ── -->
          <div class="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20 overflow-hidden">
            <div class="p-5 border-b border-neutral-100 dark:border-neutral-800">
              <h2 class="text-base font-semibold text-black dark:text-white">
                {{ t("bwallet.tx_history") }}
              </h2>
            </div>

            <div class="p-5">
              <p v-if="!transactions.length" class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ t("bwallet.no_tx") }}
              </p>

              <div v-else class="space-y-2">
                <div v-for="tx in transactions" :key="tx.id"
                  class="flex items-start justify-between gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" :class="txBadgeClass(tx.type)">
                        {{ txTypeLabel(tx.type, tx.source) }}
                      </span>
                      <span v-if="tx.order_id" class="font-mono text-xs text-neutral-400 dark:text-neutral-500">
                        #{{ shortId(tx.order_id) }}
                      </span>
                    </div>
                    <p v-if="tx.note" class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                      {{ tx.note }}
                    </p>
                    <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {{ formatDate(tx.created_at) }}
                    </p>
                  </div>
                  <span class="text-sm font-bold shrink-0"
                    :class="String(tx.type).toLowerCase() === 'credit'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'">
                    {{ String(tx.type).toLowerCase() === "credit" ? "+" : "−" }}{{ formatMoney(tx.amount) }}
                  </span>
                </div>

                <div v-if="hasMoreTx" class="pt-2 text-center">
                  <button type="button"
                    class="px-5 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700 transition disabled:opacity-50"
                    :disabled="isLoadingMore" @click="loadMoreTx">
                    {{ isLoadingMore ? t("bwallet.loading") : t("bwallet.load_more") }}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </template>

      <!-- ── Refund Request Modal ── -->
      <Teleport to="body">
        <Transition name="fade">
          <div v-if="showModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
            @click.self="closeModal">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeModal" />

            <!-- Dialog -->
            <div class="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">

              <!-- Dialog header -->
              <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <h3 class="text-base font-semibold text-black dark:text-white">
                  {{ t("bwallet.modal_title") }}
                </h3>
                <button type="button"
                  class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
                  @click="closeModal">
                  <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
                </button>
              </div>

              <!-- Dialog body -->
              <div class="px-6 py-5 space-y-4">

                <!-- Order info -->
                <div class="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <div class="flex justify-between items-center">
                    <div>
                      <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t("bwallet.modal_order") }}</p>
                      <p class="font-mono text-sm font-semibold text-black dark:text-white">
                        #{{ shortId(modalOrder?.id) }}
                      </p>
                    </div>
                    <div class="text-right">
                      <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t("bwallet.modal_amount") }}</p>
                      <p class="text-lg font-bold text-black dark:text-white">
                        {{ formatMoney(modalOrder?.total_price) }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Reason -->
                <div>
                  <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {{ t("bwallet.modal_reason") }}
                  </label>
                  <div class="space-y-2">
                    <label
                      class="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition"
                      :class="modalReason === 'product_defect'
                        ? 'border-alizarin-crimson-500 bg-alizarin-crimson-50 dark:bg-alizarin-crimson-950/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'">
                      <input type="radio" value="product_defect" v-model="modalReason" class="mt-0.5 accent-alizarin-crimson-600" />
                      <div>
                        <p class="text-sm font-medium text-black dark:text-white">
                          {{ t("bwallet.reason_product_defect") }}
                        </p>
                        <p class="text-xs text-neutral-500 dark:text-neutral-400">
                          {{ t("bwallet.refund_cond_3") }}
                        </p>
                      </div>
                    </label>
                    <label
                      class="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition"
                      :class="modalReason === 'not_shipped_3_days'
                        ? 'border-alizarin-crimson-500 bg-alizarin-crimson-50 dark:bg-alizarin-crimson-950/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'">
                      <input type="radio" value="not_shipped_3_days" v-model="modalReason" class="mt-0.5 accent-alizarin-crimson-600" />
                      <div>
                        <p class="text-sm font-medium text-black dark:text-white">
                          {{ t("bwallet.reason_not_shipped") }}
                        </p>
                        <p class="text-xs text-neutral-500 dark:text-neutral-400">
                          {{ t("bwallet.refund_cond_2") }}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Note -->
                <div>
                  <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {{ t("bwallet.modal_note") }}
                  </label>
                  <textarea v-model="modalNote" rows="3"
                    :placeholder="t('bwallet.modal_note_placeholder')"
                    class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-black dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 resize-none focus:border-alizarin-crimson-400 focus:outline-none transition" />
                </div>

                <!-- Error -->
                <p v-if="submitError"
                  class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5">
                  {{ submitError }}
                </p>
              </div>

              <!-- Dialog footer -->
              <div class="flex gap-3 px-6 py-4 border-t border-neutral-100 dark:border-neutral-800">
                <button type="button"
                  class="flex-1 px-4 py-2.5 bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white rounded-xl text-sm font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-600 transition"
                  :disabled="submitting" @click="closeModal">
                  {{ t("bwallet.modal_cancel") }}
                </button>
                <button type="button"
                  class="flex-1 px-4 py-2.5 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl text-sm font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition disabled:opacity-50"
                  :disabled="submitting" @click="submitRequest">
                  <span v-if="submitting" class="flex items-center justify-center gap-2">
                    <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-4 h-4" />
                    {{ t("bwallet.modal_submitting") }}
                  </span>
                  <span v-else>{{ t("bwallet.modal_submit") }}</span>
                </button>
              </div>

            </div>
          </div>
        </Transition>
      </Teleport>

    </ClientOnly>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
