// เฉพาะ role seller — แอดมินใช้ /admin สำหรับ CMS

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return;

  const { isAuthenticated, checkAuth } = useAuth();
  const { isSeller } = useRoles();
  const localePath = useLocalePath();

  checkAuth();
  await nextTick();

  if (!isAuthenticated.value) {
    return navigateTo(localePath("/login"));
  }
  if (!isSeller.value) {
    return navigateTo(localePath("/"));
  }
});
