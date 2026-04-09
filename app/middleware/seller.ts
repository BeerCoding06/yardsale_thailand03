// หน้าผู้ขาย: ผู้ซื้อ (user) ผู้ขาย (seller) และแอดมิน — ต้องล็อกอิน

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;

  const { isAuthenticated, checkAuth } = useAuth();
  const { canAccessSellerPortal } = useRoles();
  const localePath = useLocalePath();

  checkAuth();
  await nextTick();

  if (!isAuthenticated.value) {
    return navigateTo(localePath("/login"));
  }
  if (!canAccessSellerPortal.value) {
    return navigateTo(localePath("/"));
  }
});
