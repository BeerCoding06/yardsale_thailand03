/**
 * บทบาทจาก backend: user_role ENUM ('user' | 'seller' | 'admin')
 * - user: ผู้ซื้อทั่วไป (ช้อป / ออเดอร์ของตัวเอง)
 * - seller: ผู้ขาย (สินค้าและออเดอร์ฝั่งร้าน)
 * - admin: CMS ระดับระบบ (/admin/*)
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

  return {
    role: readonly(role),
    isAdmin,
    isSeller,
    isBuyer,
    userIsAdmin,
  };
}
