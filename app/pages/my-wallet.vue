<!-- app/pages/my-wallet.vue — กระเป๋าเงินผู้ซื้อ (รีฟันด์ / ยอดคงเหลือ) -->
<script setup>
definePageMeta({
  middleware: "auth",
  ssr: false,
});

const { user, isAuthenticated, checkAuth } = useAuth();
const router = useRouter();
const localePath = useLocalePath();
const { endpoint, hasRemoteApi } = useCmsApi();
const { t, locale } = useI18n();

const isClient = ref(false);
const isLoading = ref(true);
const isLoadingMore = ref(false);
const error = ref(null);

const wallet = ref(null);
const transactions = ref([]);
const pagination = ref(null);
const currentOffset = ref(0);
const PAGE_SIZE = 20;

const isThaiLocale = computed(() =>
  String(locale.value || "").toLowerCase().startsWith("th")
);

function cmsPath(rel) {
  return hasRemoteApi ? endpoint(rel) : `/api/${rel}`;
}

function unwrapApi(res) {
  if (res?.success === true && res.data != null && typeof res.data === "object") {
    return res.data;
  }
  return res;
}

function apiErrorMessage(e) {
  const d = e?.data;
  if (d?.error?.message) return String(d.error.message);
  if (d?.message) return String(d.message);
  return e?.message ? String(e.message) : "";
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat(isThaiLocale.value ? "th-TH" : "en-GB", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(x);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(isThaiLocale.value ? "th-TH" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function txTypeLabel(type, source) {
  const t_str = String(type || "").toLowerCase();
  const s_str = String(source || "").toLowerCase();
  if (t_str === "credit" && s_str === "refund") return t("bwallet.tx_refund");
  if (t_str === "debit" && s_str === "purchase") return t("bwallet.tx_purchase");
  if (t_str === "credit" && s_str === "admin_credit") return t("bwallet.tx_admin_credit");
  if (t_str === "debit" && s_str === "admin_debit") return t("bwallet.tx_admin_debit");
  return t_str === "credit" ? t("bwallet.tx_credit") : t("bwallet.tx_debit");
}

function txBadgeClass(type) {
  return String(type || "").toLowerCase() === "credit"
    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
    : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300";
}

async function loadWallet() {
  const jwtToken = user.value?.token;
  if (!jwtToken) { error.value = t("bwallet.error_no_token"); return; }
  const raw = await $fetch(cmsPath("buyer-wallet"), {
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  const body = unwrapApi(raw);
  wallet.value = body?.wallet ?? null;
  transactions.value = Array.isArray(body?.transactions) ? body.transactions : [];
  currentOffset.value = transactions.value.length;
}

async function loadMoreTransactions() {
  const jwtToken = user.value?.token;
  if (!jwtToken) return;
  isLoadingMore.value = true;
  try {
    const raw = await $fetch(cmsPath("buyer-wallet/transactions"), {
      headers: { Authorization: `Bearer ${jwtToken}` },
      query: { limit: PAGE_SIZE, offset: currentOffset.value },
    });
    const body = unwrapApi(raw);
    const newTxs = Array.isArray(body?.transactions) ? body.transactions : [];
    pagination.value = body?.pagination ?? null;
    transactions.value = [...transactions.value, ...newTxs];
    currentOffset.value += newTxs.length;
  } catch (e) {
    error.value = apiErrorMessage(e) || t("bwallet.error_load");
  } finally {
    isLoadingMore.value = false;
  }
}

const hasMore = computed(() => {
  if (!pagination.value) return false;
  return currentOffset.value < (pagination.value.total ?? 0);
});

async function refresh() {
  isLoading.value = true;
  error.value = null;
  transactions.value = [];
  currentOffset.value = 0;
  pagination.value = null;
  try {
    await loadWallet();
  } catch (e) {
    error.value = apiErrorMessage(e) || t("bwallet.error_load");
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  isClient.value = true;
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
      <template v-if="isLoading">
        <div class="flex items-center justify-center min-h-[50vh]">
          <div class="text-center">
            <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-8 h-8 mb-4 text-neutral-400 dark:text-neutral-600 mx-auto" />
            <p class="text-neutral-500 dark:text-neutral-400">{{ t("bwallet.loading") }}</p>
          </div>
        </div>
      </template>

      <template v-else-if="error">
        <div class="max-w-3xl mx-auto p-6">
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
            <button
              type="button"
              class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
              @click="refresh"
            >
              {{ t("bwallet.retry") }}
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="max-w-3xl mx-auto p-6 space-y-6">

          <!-- Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold text-black dark:text-white">
                {{ t("bwallet.title") }}
              </h1>
              <p class="text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t("bwallet.subtitle") }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                :to="localePath('/my-orders')"
                class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-center text-sm"
              >
                {{ t("bwallet.my_orders") }}
              </NuxtLink>
              <NuxtLink
                :to="localePath('/')"
                class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-center text-sm"
              >
                {{ t("bwallet.back_home") }}
              </NuxtLink>
              <button
                type="button"
                class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-sm"
                @click="refresh"
              >
                {{ t("bwallet.refresh") }}
              </button>
            </div>
          </div>

          <!-- Balance card -->
          <div class="rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30">
            <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
              {{ t("bwallet.balance_label") }}
            </p>
            <p class="text-4xl font-bold text-black dark:text-white">
              {{ formatMoney(wallet?.balance ?? 0) }}
            </p>
            <p v-if="wallet?.updated_at" class="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
              {{ t("bwallet.updated_at") }}: {{ formatDate(wallet.updated_at) }}
            </p>
          </div>

          <!-- Refund info -->
          <div class="rounded-2xl p-6 border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/20 space-y-2">
            <h2 class="text-base font-semibold text-amber-900 dark:text-amber-200">
              {{ t("bwallet.refund_info_title") }}
            </h2>
            <ul class="list-disc pl-5 space-y-1 text-sm text-amber-800 dark:text-amber-300">
              <li>{{ t("bwallet.refund_cond_1") }}</li>
              <li>{{ t("bwallet.refund_cond_2") }}</li>
              <li>{{ t("bwallet.refund_cond_3") }}</li>
            </ul>
          </div>

          <!-- Transaction history -->
          <div class="rounded-2xl p-6 border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20">
            <h2 class="text-lg font-semibold text-black dark:text-white mb-4">
              {{ t("bwallet.tx_history") }}
            </h2>

            <p v-if="!transactions.length" class="text-neutral-500 dark:text-neutral-400 text-sm">
              {{ t("bwallet.no_tx") }}
            </p>

            <div v-else class="space-y-3">
              <div
                v-for="tx in transactions"
                :key="tx.id"
                class="flex items-start justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span
                      class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      :class="txBadgeClass(tx.type)"
                    >
                      {{ txTypeLabel(tx.type, tx.source) }}
                    </span>
                    <span v-if="tx.order_id" class="font-mono text-xs text-neutral-400 dark:text-neutral-500 truncate">
                      #{{ String(tx.order_id).replace(/-/g,'').slice(0,12) }}
                    </span>
                  </div>
                  <p v-if="tx.note" class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">
                    {{ tx.note }}
                  </p>
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    {{ formatDate(tx.created_at) }}
                  </p>
                  <p v-if="tx.expires_at" class="text-xs text-amber-500 mt-0.5">
                    {{ t("bwallet.expires_at") }}: {{ formatDate(tx.expires_at) }}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <span
                    class="text-base font-bold"
                    :class="String(tx.type).toLowerCase() === 'credit'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'"
                  >
                    {{ String(tx.type).toLowerCase() === "credit" ? "+" : "−" }}{{ formatMoney(tx.amount) }}
                  </span>
                </div>
              </div>

              <!-- Load more -->
              <div v-if="hasMore" class="text-center pt-2">
                <button
                  type="button"
                  class="px-6 py-2.5 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-sm disabled:opacity-50"
                  :disabled="isLoadingMore"
                  @click="loadMoreTransactions"
                >
                  {{ isLoadingMore ? t("bwallet.loading") : t("bwallet.load_more") }}
                </button>
              </div>
            </div>
          </div>

        </div>
      </template>
    </ClientOnly>
  </div>
</template>
