export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return;

  const { isAuthenticated, checkAuth } = useAuth();
  const { isAdmin } = useAdminRole();
  const localePath = useLocalePath();

  checkAuth();

  if (!isAuthenticated.value) {
    return navigateTo(localePath("/login"));
  }
  if (!isAdmin.value) {
    return navigateTo(localePath("/"));
  }
});
