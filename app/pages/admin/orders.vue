<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
  ssr: false,
});

const { t } = useI18n();
const { user, checkAuth } = useAuth();
const { endpoint } = useCmsApi();

const isLoading = ref(true);
const orders = ref<any[]>([]);
const error = ref<string | null>(null);

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

/** Express sendSuccess wraps payload in `data`; mock may return flat */
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
    const res = await $fetch<any>(endpoint("seller-orders"), {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (res && res.success !== false) {
      orders.value = pickOrdersPayload(res);
    } else {
      error.value = res?.error || res?.message || t("seller_orders.error_loading");
      orders.value = [];
    }
  } catch (e: any) {
    error.value = e?.message || t("seller_orders.error_loading");
    orders.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  checkAuth();
  fetchOrders();
});
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">
        {{ t("admin.orders.title") }}
      </h1>
      <p class="text-neutral-600 dark:text-neutral-400 mt-1 text-sm">
        {{ t("admin.orders.lead") }}
      </p>
    </div>

    <UCard>
      <div v-if="isLoading" class="py-12 text-center text-neutral-500">
        {{ t("general.loading") }}
      </div>
      <div v-else-if="error" class="py-8 text-center text-red-600 dark:text-red-400">
        {{ error }}
      </div>
      <div v-else-if="!orders.length" class="py-12 text-center text-neutral-500">
        {{ t("admin.orders.empty") }}
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead>
            <tr class="border-b border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_id") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_buyer") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_status") }}</th>
              <th class="py-2 pr-4 font-medium">{{ t("admin.orders.col_total") }}</th>
              <th class="py-2 font-medium">{{ t("admin.orders.col_date") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(o, i) in orders"
              :key="o.id || o.order_id || i"
              class="border-b border-neutral-100 dark:border-neutral-800"
            >
              <td class="py-3 pr-4 font-mono text-xs">
                {{ o.id ?? o.order_id ?? "—" }}
              </td>
              <td class="py-3 pr-4 text-neutral-600 dark:text-neutral-400 break-all max-w-[12rem]">
                {{ o.buyer_email ?? "—" }}
              </td>
              <td class="py-3 pr-4 capitalize">{{ o.status ?? o.order_status ?? "—" }}</td>
              <td class="py-3 pr-4">{{ o.total_price ?? o.total ?? o.grand_total ?? "—" }}</td>
              <td class="py-3 text-neutral-600 dark:text-neutral-400">
                {{ formatDate(o.created_at || o.date_created || o.createdAt || "") }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
