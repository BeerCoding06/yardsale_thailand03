// app/composables/useAuth.ts
// Composable for managing user authentication state

export const useAuth = () => {
  // Initialize user state as null to prevent hydration mismatch
  const user = useState<any>("user", () => null);
  const isAuthenticated = computed(() => !!user.value);

  const login = async (
    username: string,
    password: string,
    remember?: boolean
  ) => {
    try {
      const response = await $fetch<{
        success: boolean;
        user?: any;
      }>("/api/login", {
        method: "POST",
        body: {
          username,
          password,
          remember: remember || false,
        },
      });

      if (response.success && response.user) {
        user.value = response.user;
        if (import.meta.client) {
          localStorage.setItem("user", JSON.stringify(response.user));
        }
        return { success: true, user: response.user };
      }
      return { success: false, error: "Login failed" };
    } catch (error: any) {
      console.error("[useAuth] Login error:", error);
      return {
        success: false,
        error: error.data?.message || error.message || "Login failed",
      };
    }
  };

  const logout = () => {
    user.value = null;
    if (import.meta.client) {
      localStorage.removeItem("user");
    }
    navigateTo("/login");
  };

  const checkAuth = () => {
    if (import.meta.client) {
      try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            // ตรวจสอบว่า user object มีข้อมูลที่จำเป็น
            if (parsedUser && (parsedUser.id || parsedUser.ID)) {
              user.value = parsedUser;
            } else {
              // ถ้า user object ไม่ถูกต้อง ให้ลบออก
              localStorage.removeItem("user");
              user.value = null;
            }
          } catch (e) {
            console.error("[useAuth] Error parsing stored user:", e);
            localStorage.removeItem("user");
            user.value = null;
          }
        } else {
          user.value = null;
        }
      } catch (e) {
        console.error("[useAuth] Error checking auth:", e);
        user.value = null;
      }
    }
  };

  // Don't check auth in composable to prevent hydration mismatch
  // Auth will be checked in onMounted hooks or middleware

  return {
    user: readonly(user),
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };
};
