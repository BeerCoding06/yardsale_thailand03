/**
 * บทบาทจาก backend: user_role ENUM ('user' | 'seller' | 'admin')
 * - user: ผู้ซื้อ — ช้อป + เข้าหน้าผู้ขาย (ลงสินค้า/ออเดอร์ร้านของตน) ได้
 * - seller: ผู้ขาย
 * - admin: CMS (/admin/*) + เข้าหน้าผู้ขายได้เหมือนกัน
 */
export function userIsAdmin(u: unknown): boolean {
  if (!u || typeof u !== "object") return false;
  const o = u as Record<string, unknown>;
  if (o.role === "admin") return true;
  const r = o.roles;
  if (Array.isArray(r)) {
    return r.some(
      (x: unknown) =>
        x === "admin" ||
        (typeof x === "object" &&
          x !== null &&
          String((x as { name?: unknown }).name || "").toLowerCase() === "admin")
    );
  }
  if (typeof r === "string") return r === "admin";
  return false;
}

function normalizePrimaryRole(u: unknown): string {
  if (!u || typeof u !== "object") return "";
  const r = (u as { role?: unknown }).role;
  if (typeof r === "string") return r.toLowerCase().trim();
  return "";
}

export function useRoles() {
  const { user, isAuthenticated } = useAuth();

  const role = computed(() => normalizePrimaryRole(user.value));

  const isAdmin = computed(() => userIsAdmin(user.value));

  /** ลูกค้าทั่วไป (ไม่รวม seller/admin) */
  const isBuyer = computed(
    () =>
      isAuthenticated.value &&
      !isAdmin.value &&
      (role.value === "user" || role.value === "customer" || role.value === "")
  );

  const isSeller = computed(
    () => isAuthenticated.value && role.value === "seller"
  );

  /** หน้าผู้ขาย (สินค้าของฉัน / ออเดอร์ร้าน): ผู้ซื้อ (user) ผู้ขาย (seller) และแอดมิน */
  const canAccessSellerPortal = computed(() => {
    if (!isAuthenticated.value) return false;
    const r = role.value;
    if (r === "user" || r === "customer" || r === "seller" || r === "admin")
      return true;
    return r === "";
  });

  return {
    role: readonly(role),
    isAdmin,
    isSeller,
    isBuyer,
    canAccessSellerPortal,
    userIsAdmin,
  };
}
