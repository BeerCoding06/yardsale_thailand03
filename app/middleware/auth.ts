// app/middleware/auth.ts
// Middleware to protect routes that require authentication

export default defineNuxtRouteMiddleware((to, from) => {
  // Skip middleware on server-side to prevent hydration mismatch
  if (import.meta.server) {
    return;
  }

  // Only check on client-side
  const { isAuthenticated, checkAuth } = useAuth();

  // Ensure auth state is checked first (synchronously)
  checkAuth();

  // Check authentication - if not authenticated, redirect to login
  if (!isAuthenticated.value) {
    // Redirect to login page
    return navigateTo("/login");
  }
});
