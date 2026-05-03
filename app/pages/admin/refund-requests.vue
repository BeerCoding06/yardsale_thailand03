<!-- Admin: refund requests + evidence review -->
<script setup>
definePageMeta({ middleware: ["auth", "admin"], ssr: false });

const { t } = useI18n();
const { user, checkAuth } = useAuth();
const { endpoint } = useCmsApi();
const runConfig = useRuntimeConfig();

const loading = ref(true);
const listError = ref("");
const rows = ref([]);
const total = ref(0);

const statusFilter = ref("");
const actionBusy = ref(null);
const rejectNote = ref("");
const noteOpenId = ref(null);

async function headers() {
  const tok = user.value?.token;
  if (!tok) throw new Error("no token");
  return { Authorization: `Bearer ${tok}` };
}

function evidenceUrl(pathStr) {
  const s = String(pathStr || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const origin = String(runConfig.public?.yardsaleBackendOrigin || "").replace(/\/$/, "");
  if (origin) return origin + (s.startsWith("/") ? s : `/${s}`);
  if (import.meta.client && typeof window !== "undefined") {
    return window.location.origin + (s.startsWith("/") ? s : `/${s}`);
  }
  return s;
}

function parseEvidencePaths(raw) {
  if (Array.isArray(raw)) return raw.map((p) => String(p)).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map((p) => String(p)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isImageEvidencePath(p) {
  return /\.(jpe?g|png|gif|webp)$/i.test(String(p));
}

function formatThb(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(x);
}

function formatDt(iso) {
  if (!iso) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

async function loadList() {
  listError.value = "";
  loading.value = true;
  try {
    await checkAuth();
    const h = await headers();
    const q = statusFilter.value ? `?status=${encodeURIComponent(statusFilter.value)}` : "";
    const raw = await $fetch(endpoint(`admin/buyer-wallet/refund-requests${q}`), {
      headers: h,
    });
    rows.value = Array.isArray(raw?.requests) ? raw.requests : [];
    total.value = raw?.pagination?.total ?? rows.value.length;
  } catch (e) {
    listError.value =
      e?.data?.error?.message || e?.message || t("admin.refund_requests.load_error");
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

async function approve(id) {
  if (!id || actionBusy.value) return;
  actionBusy.value = id;
  try {
    const h = await headers();
    await $fetch(endpoint(`admin/buyer-wallet/refund-requests/${encodeURIComponent(id)}/approve`), {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: {},
    });
    await loadList();
  } catch (e) {
    listError.value = e?.data?.error?.message || e?.message || t("admin.refund_requests.action_error");
  } finally {
    actionBusy.value = null;
  }
}

async function reject(id) {
  if (!id || actionBusy.value) return;
  actionBusy.value = id;
  try {
    const h = await headers();
    await $fetch(endpoint(`admin/buyer-wallet/refund-requests/${encodeURIComponent(id)}/reject`), {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: { admin_note: rejectNote.value.trim() || undefined },
    });
    rejectNote.value = "";
    noteOpenId.value = null;
    await loadList();
  } catch (e) {
    listError.value = e?.data?.error?.message || e?.message || t("admin.refund_requests.action_error");
  } finally {
    actionBusy.value = null;
  }
}

watch(statusFilter, () => loadList());

onMounted(() => loadList());
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6 px-4 py-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.refund_requests.title") }}
      </h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
        {{ t("admin.refund_requests.subtitle") }}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <label class="text-sm text-neutral-600 dark:text-neutral-400">{{ t("admin.refund_requests.filter_status") }}</label>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-white"
      >
        <option value="">{{ t("admin.refund_requests.all") }}</option>
        <option value="pending">{{ t("admin.refund_requests.pending") }}</option>
        <option value="approved">{{ t("admin.refund_requests.approved") }}</option>
        <option value="rejected">{{ t("admin.refund_requests.rejected") }}</option>
      </select>
      <span v-if="total" class="text-xs text-neutral-500">{{ total }} {{ t("admin.refund_requests.total") }}</span>
    </div>

    <div
      v-if="listError"
      class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ listError }}
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-svg-spinners-90-ring-with-bg" class="w-10 h-10 text-neutral-400" />
    </div>

    <p v-else-if="!rows.length" class="text-neutral-500 dark:text-neutral-400 text-sm py-8 text-center">
      {{ t("admin.refund_requests.empty") }}
    </p>

    <div v-else class="space-y-4">
      <div
        v-for="r in rows"
        :key="r.id"
        class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase"
                :class="
                  r.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : r.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                "
              >
                {{ r.status }}
              </span>
              <span class="text-sm font-mono text-neutral-500">#{{ String(r.order_id || "").replace(/-/g, "").slice(0, 10).toUpperCase() }}</span>
            </div>
            <p class="text-sm text-neutral-700 dark:text-neutral-300">
              {{ r.user_name || r.user_email }} · {{ r.user_email }}
            </p>
            <p class="text-xs text-neutral-500">{{ t("admin.refund_requests.reason") }}: {{ r.reason }}</p>
            <p v-if="r.note" class="text-xs text-neutral-600 dark:text-neutral-400 mt-1 italic">"{{ r.note }}"</p>
            <p class="text-xs text-neutral-400 mt-1">{{ formatDt(r.created_at) }}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-neutral-900 dark:text-white">{{ formatThb(r.order_amount) }}</p>
          </div>
        </div>

        <div class="mt-4">
          <p class="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
            {{ t("admin.refund_requests.evidence") }}
          </p>
          <div v-if="parseEvidencePaths(r.evidence_paths).length" class="flex flex-wrap gap-2">
            <div
              v-for="(ep, ei) in parseEvidencePaths(r.evidence_paths)"
              :key="ei"
              class="shrink-0"
            >
              <a
                v-if="!isImageEvidencePath(ep)"
                :href="evidenceUrl(ep)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 text-xs font-medium"
              >
                <UIcon name="i-heroicons-document" class="w-4 h-4" />
                PDF {{ ei + 1 }}
              </a>
              <a
                v-else
                :href="evidenceUrl(ep)"
                target="_blank"
                rel="noopener noreferrer"
                class="block"
              >
                <img
                  :src="evidenceUrl(ep)"
                  alt=""
                  class="h-24 w-24 object-cover rounded-xl border border-neutral-200 dark:border-neutral-700"
                  loading="lazy"
                />
              </a>
            </div>
          </div>
          <p v-else class="text-xs text-amber-700 dark:text-amber-400">{{ t("admin.refund_requests.no_evidence") }}</p>
        </div>

        <div v-if="r.admin_note" class="mt-4 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs">
          <span class="font-medium text-neutral-600 dark:text-neutral-400">{{ t("admin.refund_requests.admin_note") }}:</span>
          {{ r.admin_note }}
        </div>

        <div v-if="r.status === 'pending'" class="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            :disabled="actionBusy === r.id"
            @click="approve(r.id)"
          >
            {{ t("admin.refund_requests.approve") }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 text-sm font-semibold"
            @click="noteOpenId = noteOpenId === r.id ? null : r.id"
          >
            {{ t("admin.refund_requests.reject") }}
          </button>
        </div>

        <div v-if="noteOpenId === r.id && r.status === 'pending'" class="mt-3 space-y-2">
          <textarea
            v-model="rejectNote"
            rows="2"
            class="w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            :placeholder="t('admin.refund_requests.reject_note_placeholder')"
          />
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
            :disabled="actionBusy === r.id"
            @click="reject(r.id)"
          >
            {{ t("admin.refund_requests.confirm_reject") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
