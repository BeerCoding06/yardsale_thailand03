// app/composables/useAuth.ts
// Composable for managing user authentication state

import { useCmsApi } from "./useCmsApi";

/** Express มักคืน { error: { message, code } }; ต้องดึงข้อความเป็น string ไม่ให้ UI ได้ [object Object] */
function pickErrorMessage(source: unknown, fallback = "Login failed"): string {
  if (source == null || source === "") return fallback;
  if (typeof source === "string") return source;
  if (typeof source === "object" && source !== null && "message" in source) {
    const m = (source as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

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

      const { endpoint } = useCmsApi();
      const response = await $fetch<{
        success: boolean;
        user?: any;
        data?: { user?: any; token?: string };
        message?: string;
        error?: string;
      }>(endpoint("login"), {
        method: "POST",
        body: {
          username,
          password,
          remember: remember || false,
        },
      });

      const raw: any = response;
      const mergedUser =
        raw?.user ??
        raw?.data?.user ??
        (raw?.data && typeof raw.data === "object" && "email" in raw.data
          ? raw.data
          : null);

      if (mergedUser && raw.success !== false) {
        const token =
          mergedUser.token ?? raw?.data?.token ?? raw?.token;
        const normalized = token
          ? { ...mergedUser, token }
          : mergedUser;
        user.value = normalized;
        if (import.meta.client) {
          localStorage.setItem("user", JSON.stringify(normalized));
        }
        return { success: true, user: normalized };
      }

      const errorMsg = pickErrorMessage(
        response?.error ?? response?.message,
        "Login failed"
      );
      console.warn("[useAuth] Login failed:", errorMsg);
      if (response?.debug) {
        console.warn("[useAuth] Debug info:", response.debug);
      }
      return { success: false, error: errorMsg };
    } catch (error: any) {
      console.error("[useAuth] Login error:", error);
      if (error?.data?.debug) {
        console.error("[useAuth] Debug info:", error.data.debug);
      }
      console.error("[useAuth] Error details:", {
        message: error?.message,
        statusCode: error?.statusCode,
        data: error?.data,
        response: error?.response
      });
      
      // Extract error message from various possible locations
      let errorMessage = "Login failed";
      if (error?.data?.error != null) {
        errorMessage = pickErrorMessage(error.data.error);
      } else if (error?.data?.message != null) {
        errorMessage = pickErrorMessage(error.data.message);
      } else if (error?.message) {
        errorMessage = pickErrorMessage(error.message);
      } else if (error?.statusMessage) {
        errorMessage = pickErrorMessage(error.statusMessage);
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

  /** ดึงข้อมูล user ล่าสุดจาก WordPress (ใช้ในหน้า profile เพื่อให้ได้ first_name, last_name ฯลฯ) */
  const fetchUser = async (userId?: number) => {
    const id = userId ?? user.value?.id ?? user.value?.ID;
    if (!id) return null;
    try {
      const { endpoint } = useCmsApi();
      const jwt = user.value?.token;
      const data = await $fetch<{ success?: boolean; user?: any; data?: { user?: any } }>(
        endpoint("me"),
        {
          query: { user_id: id },
          headers: jwt
            ? { Authorization: `Bearer ${jwt}` }
            : undefined,
        }
      );
      const nextUser = data?.user ?? data?.data?.user;
      if (nextUser) {
        const merged = { ...user.value, ...nextUser };
        user.value = merged;
        if (import.meta.client) {
          localStorage.setItem("user", JSON.stringify(merged));
        }
        return merged;
      }
    } catch (e) {
      console.warn("[useAuth] fetchUser failed:", e);
    }
    return null;
  };

  return {
    user: readonly(user),
    isAuthenticated,
    login,
    logout,
    checkAuth,
    fetchUser,
  };
};
