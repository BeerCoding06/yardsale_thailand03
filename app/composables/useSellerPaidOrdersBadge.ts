import { unwrapYardsaleResponse } from "~/utils/cmsApiEndpoint";

/**
 * Badge จำนวนออเดอร์ที่ลูกค้าชำระแล้วแต่ยังไม่จัดส่ง (pending/preparing) — เมนู seller-orders
 */
export function useSellerPaidOrdersBadge() {
  const { user } = useAuth();
  const { canAccessSellerPortal } = useRoles();
  const { endpoint, hasRemoteApi } = useCmsApi();

  const paidCount = useState("seller-paid-orders-count", () => 0);

  async function refreshPaidCount() {
    if (!import.meta.client) return;
    if (!user.value?.token || !canAccessSellerPortal.value) {
      paidCount.value = 0;
      return;
    }
    try {
      const path = hasRemoteApi
        ? endpoint("seller-orders/paid-count")
        : "/api/seller-orders/paid-count";
      const raw = await $fetch(path, {
        headers: { Authorization: `Bearer ${user.value.token}` },
      });
      const inner = unwrapYardsaleResponse(raw) ?? raw;
      const n = Number((inner as { paid_count?: number })?.paid_count ?? 0);
      paidCount.value = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      paidCount.value = 0;
    }
  }

  function badgeLabel(count?: number): string {
    const n = count ?? paidCount.value;
    if (n <= 0) return "";
    if (n > 99) return "99+";
    return String(n);
  }

  return {
    paidCount: readonly(paidCount),
    badgeLabel,
    refreshPaidCount,
    showBadge: computed(() => paidCount.value > 0 && canAccessSellerPortal.value),
  };
}
