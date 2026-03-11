// app/middleware/auth.ts
// Middleware to protect routes that require authentication

export default defineNuxtRouteMiddleware(async (to, from) => {
  // Skip middleware on server-side to prevent hydration mismatch
  if (import.meta.server) {
    return;
  }

  const { isAuthenticated, checkAuth } = useAuth();
  checkAuth();
  await nextTick();

  if (!isAuthenticated.value) {
    return navigateTo("/login");
  }
});
