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
      console.log("[useAuth] Attempting login for username:", username);
      
      const response = await $fetch<{
        success: boolean;
        user?: any;
        message?: string;
        error?: string;
      }>("/api/login", {
        method: "POST",
        body: {
          username,
          password,
          remember: remember || false,
        },
      });

      console.log("[useAuth] Login response:", response);
      console.log("[useAuth] Response success:", response?.success);
      console.log("[useAuth] Response has user:", !!response?.user);

      if (response && response.success && response.user) {
        user.value = response.user;
        if (import.meta.client) {
          localStorage.setItem("user", JSON.stringify(response.user));
        }
        console.log("[useAuth] Login successful, user saved");
        return { success: true, user: response.user };
      }
      
      const errorMsg = response?.error || response?.message || "Login failed";
      console.warn("[useAuth] Login failed:", errorMsg);
      return { success: false, error: errorMsg };
    } catch (error: any) {
      console.error("[useAuth] Login error:", error);
      console.error("[useAuth] Error details:", {
        message: error?.message,
        statusCode: error?.statusCode,
        data: error?.data,
        response: error?.response
      });
      
      // Extract error message from various possible locations
      let errorMessage = "Login failed";
      if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.statusMessage) {
        errorMessage = error.statusMessage;
      }
      
      return {
        success: false,
        error: errorMessage,
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
