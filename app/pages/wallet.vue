<!--app/pages/wallet.vue — กระเป๋าเงินผู้ขาย (escrow / ถอน) ต่อ GET /api/wallet -->
<script setup>
definePageMeta({
  middleware: "auth",
  ssr: false,
});

const { user, isAuthenticated, checkAuth } = useAuth();
const { canAccessSellerPortal } = useRoles();
const router = useRouter();
const localePath = useLocalePath();
const { endpoint, hasRemoteApi } = useCmsApi();
const { t, locale } = useI18n();

const isClient = ref(false);
const isLoading = ref(true);
const error = ref(null);

const wallet = ref(null);
const transactions = ref([]);
const withdrawalPolicy = ref(null);
const bankOptions = ref(null);
const withdrawals = ref([]);

const withdrawForm = ref({
  amount: "",
  bank_code: "",
  account_holder_name: "",
  account_number: "",
});
const submitting = ref(false);
const withdrawFieldError = ref("");

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

async function notifySuccess(message) {
  try {
    const { push } = await import("notivue");
    push.success(String(message || ""));
  } catch {
    // toast is optional; avoid breaking withdraw flow
  }
}

const isThaiLocale = computed(() =>
  String(locale.value || "")
    .toLowerCase()
    .startsWith("th")
);

function bankLabel(b) {
  if (!b || typeof b !== "object") return "";
  return isThaiLocale.value ? b.label_th || b.label_en : b.label_en || b.label_th;
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

function txTypeLabel(type) {
  const k = String(type || "").toLowerCase();
  if (k === "escrow_in") return t("wallet.tx_escrow_in");
  if (k === "release") return t("wallet.tx_release");
  if (k === "withdraw") return t("wallet.tx_withdraw");
  return t("wallet.tx_unknown");
}

function withdrawalStatusLabel(status) {
  const k = String(status || "").toLowerCase();
  const map = {
    pending: "wallet.wd_pending",
    approved: "wallet.wd_approved",
    rejected: "wallet.wd_rejected",
    paid: "wallet.wd_paid",
    completed: "wallet.wd_paid",
  };
  return t(map[k] || "wallet.wd_unknown");
}

const policyBullets = computed(() => {
  const p = withdrawalPolicy.value;
  if (!p) return [];
  const arr = isThaiLocale.value ? p.notices_th : p.notices_en;
  return Array.isArray(arr) ? arr : [];
});

const feePercent = computed(() => {
  const fromWallet = withdrawalPolicy.value?.fee_percent;
  const fromBanks = bankOptions.value?.fee_percent;
  const n = Number(fromWallet ?? fromBanks ?? 5);
  return Number.isFinite(n) ? n : 5;
});

const feeRate = computed(() => {
  const r = Number(bankOptions.value?.fee_rate ?? withdrawalPolicy.value?.fee_rate ?? 0.05);
  return Number.isFinite(r) && r > 0 ? r : 0.05;
});

const withdrawAmountNum = computed(() => {
  const n = Number(String(withdrawForm.value.amount || "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
});

const estimatedNet = computed(() => {
  const gross = withdrawAmountNum.value;
  if (gross <= 0) return 0;
  const net = gross * (1 - feeRate.value);
  return Math.round(net * 100) / 100;
});

async function loadWallet() {
  const jwtToken = user.value?.token;
  if (!jwtToken) {
    error.value = t("wallet.error_no_token");
    return;
  }
  const raw = await $fetch(cmsPath("wallet"), {
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  const body = unwrapApi(raw);
  wallet.value = body?.wallet ?? null;
  transactions.value = Array.isArray(body?.transactions) ? body.transactions : [];
  withdrawalPolicy.value = body?.withdrawal_policy ?? null;
}

async function loadBankOptions() {
  const jwtToken = user.value?.token;
  if (!jwtToken) return;
  const raw = await $fetch(cmsPath("wallet/bank-options"), {
    headers: { Authorization: `Bearer ${jwtToken}` },
  });
  bankOptions.value = unwrapApi(raw);
}

async function loadWithdrawals() {
  const jwtToken = user.value?.token;
  if (!jwtToken) return;
  const raw = await $fetch(cmsPath("wallet/withdrawals"), {
    headers: { Authorization: `Bearer ${jwtToken}` },
    query: { limit: 30, offset: 0 },
  });
  const body = unwrapApi(raw);
  withdrawals.value = Array.isArray(body?.withdrawals) ? body.withdrawals : [];
}

async function fetchAll() {
  error.value = null;
  withdrawFieldError.value = "";
  const jwtToken = user.value?.token;
  if (!jwtToken) {
    error.value = t("wallet.error_no_token");
    return;
  }
  await Promise.all([loadWallet(), loadBankOptions(), loadWithdrawals()]);
}

async function refresh() {
  isLoading.value = true;
  error.value = null;
  try {
    await fetchAll();
  } catch (e) {
    error.value = apiErrorMessage(e) || t("wallet.error_load");
  } finally {
    isLoading.value = false;
  }
}

async function submitWithdraw() {
  withdrawFieldError.value = "";
  const jwtToken = user.value?.token;
  if (!jwtToken) {
    withdrawFieldError.value = t("wallet.error_no_token");
    return;
  }
  const amount = withdrawAmountNum.value;
  const bank = String(withdrawForm.value.bank_code || "").trim().toUpperCase();
  const name = String(withdrawForm.value.account_holder_name || "").trim();
  const acct = String(withdrawForm.value.account_number || "").replace(/\D/g, "");

  if (amount <= 0) {
    withdrawFieldError.value = t("wallet.error_amount");
    return;
  }
  const avail = Number(wallet.value?.available_balance ?? 0);
  if (amount > avail) {
    withdrawFieldError.value = t("wallet.error_insufficient");
    return;
  }
  if (!bank) {
    withdrawFieldError.value = t("wallet.error_bank");
    return;
  }
  if (name.length < 2) {
    withdrawFieldError.value = t("wallet.error_holder");
    return;
  }
  if (acct.length < 8 || acct.length > 20) {
    withdrawFieldError.value = t("wallet.error_account");
    return;
  }

  submitting.value = true;
  try {
    const raw = await $fetch(cmsPath("wallet/withdraw"), {
      method: "POST",
      headers: { Authorization: `Bearer ${jwtToken}` },
      body: {
        amount,
        bank_code: bank,
        account_holder_name: name,
        account_number: acct,
      },
    });
    const body = unwrapApi(raw);
    const msg =
      (isThaiLocale.value ? body?.message : body?.message_en) ||
      body?.message ||
      t("wallet.withdraw_success");
    await notifySuccess(msg);
    withdrawForm.value = {
      amount: "",
      bank_code: withdrawForm.value.bank_code,
      account_holder_name: "",
      account_number: "",
    };
    await fetchAll();
  } catch (e) {
    withdrawFieldError.value = apiErrorMessage(e) || t("wallet.error_withdraw");
  } finally {
    submitting.value = false;
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
  if (!canAccessSellerPortal.value) {
    router.push(localePath("/"));
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
            <UIcon
              name="i-svg-spinners-90-ring-with-bg"
              class="w-8 h-8 mb-4 text-neutral-400 dark:text-neutral-600 mx-auto"
            />
            <p class="text-neutral-500 dark:text-neutral-400">{{ t("wallet.loading") }}</p>
          </div>
        </div>
      </template>

      <template v-else-if="error">
        <div class="max-w-3xl mx-auto p-6">
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center"
          >
            <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
            <button
              type="button"
              class="inline-block px-6 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg"
              @click="refresh"
            >
              {{ t("wallet.retry") }}
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="max-w-4xl mx-auto p-6 space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold text-black dark:text-white">
                {{ t("wallet.title") }}
              </h1>
              <p class="text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t("wallet.subtitle") }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                :to="localePath('/')"
                class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-center"
              >
                {{ t("wallet.back_home") }}
              </NuxtLink>
              <NuxtLink
                :to="localePath('/seller-orders')"
                class="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-xl font-semibold hover:bg-neutral-300 dark:hover:bg-neutral-700 transition text-center"
              >
                {{ t("auth.seller_orders") }}
              </NuxtLink>
            </div>
          </div>

          <!-- Balances -->
          <div class="grid sm:grid-cols-2 gap-4">
            <div
              class="rounded-2xl p-6 border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30"
            >
              <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                {{ t("wallet.available") }}
              </p>
              <p class="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">
                {{ formatMoney(wallet?.available_balance ?? 0) }}
              </p>
            </div>
            <div
              class="rounded-2xl p-6 border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30"
            >
              <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
                {{ t("wallet.escrow") }}
              </p>
              <p class="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">
                {{ formatMoney(wallet?.escrow_balance ?? 0) }}
              </p>
            </div>
          </div>
          <p v-if="wallet?.updated_at" class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t("wallet.updated_at") }}: {{ formatDate(wallet.updated_at) }}
          </p>

          <!-- Policy -->
          <div
            v-if="policyBullets.length"
            class="rounded-2xl p-6 border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20"
          >
            <h2 class="text-lg font-semibold text-black dark:text-white mb-3">
              {{ t("wallet.policy_title") }}
            </h2>
            <ul class="list-disc pl-5 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li v-for="(line, i) in policyBullets" :key="i">{{ line }}</li>
            </ul>
          </div>

          <!-- Withdraw -->
          <div
            class="rounded-2xl p-6 border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20 space-y-4"
          >
            <h2 class="text-lg font-semibold text-black dark:text-white">
              {{ t("wallet.withdraw_title") }}
            </h2>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t("wallet.fee_hint", { percent: feePercent }) }}
              <span v-if="withdrawAmountNum > 0" class="block mt-1 font-medium text-black dark:text-white">
                {{ t("wallet.estimated_net", { net: formatMoney(estimatedNet) }) }}
              </span>
            </p>
            <div
              v-if="withdrawFieldError"
              class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2"
            >
              {{ withdrawFieldError }}
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">{{
                  t("wallet.amount")
                }}</label>
                <input
                  v-model="withdrawForm.amount"
                  type="number"
                  min="1"
                  step="0.01"
                  class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-black dark:text-white"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">{{
                  t("wallet.bank")
                }}</label>
                <select
                  v-model="withdrawForm.bank_code"
                  class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-black dark:text-white"
                >
                  <option value="">{{ t("wallet.bank_placeholder") }}</option>
                  <option
                    v-for="b in bankOptions?.banks || []"
                    :key="b.code"
                    :value="b.code"
                  >
                    {{ bankLabel(b) }}
                  </option>
                </select>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">{{
                  t("wallet.account_name")
                }}</label>
                <input
                  v-model="withdrawForm.account_holder_name"
                  type="text"
                  autocomplete="name"
                  class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-black dark:text-white"
                />
              </div>
              <div class="sm:col-span-2">
                <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">{{
                  t("wallet.account_number")
                }}</label>
                <input
                  v-model="withdrawForm.account_number"
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  class="w-full rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-black dark:text-white"
                />
              </div>
            </div>
            <button
              type="button"
              class="w-full sm:w-auto px-8 py-3 bg-alizarin-crimson-600 dark:bg-alizarin-crimson-500 text-white rounded-xl font-semibold hover:bg-alizarin-crimson-700 dark:hover:bg-alizarin-crimson-600 transition shadow-lg disabled:opacity-50 disabled:pointer-events-none"
              :disabled="submitting"
              @click="submitWithdraw"
            >
              {{ submitting ? t("wallet.submitting") : t("wallet.submit_withdraw") }}
            </button>
          </div>

          <!-- Transactions -->
          <div
            class="rounded-2xl p-6 border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20"
          >
            <h2 class="text-lg font-semibold text-black dark:text-white mb-4">
              {{ t("wallet.transactions") }}
            </h2>
            <p v-if="!transactions.length" class="text-neutral-500 dark:text-neutral-400 text-sm">
              {{ t("wallet.no_tx") }}
            </p>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead>
                  <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                    <th class="py-2 pr-4">{{ t("wallet.tx_date") }}</th>
                    <th class="py-2 pr-4">{{ t("wallet.tx_type") }}</th>
                    <th class="py-2 pr-4">{{ t("wallet.tx_order") }}</th>
                    <th class="py-2 text-right">{{ t("wallet.tx_amount") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tx in transactions"
                    :key="tx.id"
                    class="border-b border-neutral-100 dark:border-neutral-800 text-black dark:text-white"
                  >
                    <td class="py-2 pr-4 whitespace-nowrap">{{ formatDate(tx.created_at) }}</td>
                    <td class="py-2 pr-4">{{ txTypeLabel(tx.type) }}</td>
                    <td class="py-2 pr-4 font-mono text-xs">{{ tx.order_id || "—" }}</td>
                    <td class="py-2 text-right font-medium">{{ formatMoney(tx.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Withdrawals history -->
          <div
            class="rounded-2xl p-6 border-2 border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/20"
          >
            <h2 class="text-lg font-semibold text-black dark:text-white mb-4">
              {{ t("wallet.withdrawals_title") }}
            </h2>
            <p v-if="!withdrawals.length" class="text-neutral-500 dark:text-neutral-400 text-sm">
              {{ t("wallet.no_withdrawals") }}
            </p>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm text-left">
                <thead>
                  <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                    <th class="py-2 pr-4">{{ t("wallet.tx_date") }}</th>
                    <th class="py-2 pr-4">{{ t("wallet.status") }}</th>
                    <th class="py-2 pr-4">{{ t("wallet.bank") }}</th>
                    <th class="py-2 text-right">{{ t("wallet.tx_amount") }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="w in withdrawals"
                    :key="w.id"
                    class="border-b border-neutral-100 dark:border-neutral-800 text-black dark:text-white"
                  >
                    <td class="py-2 pr-4 whitespace-nowrap">{{ formatDate(w.requested_at) }}</td>
                    <td class="py-2 pr-4">{{ withdrawalStatusLabel(w.status) }}</td>
                    <td class="py-2 pr-4">
                      {{ w.bank_code || "—" }}
                      <span v-if="w.account_number_last4" class="text-neutral-500 text-xs">
                        ····{{ w.account_number_last4 }}
                      </span>
                    </td>
                    <td class="py-2 text-right font-medium">{{ formatMoney(w.amount) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
