/**
 * $fetch ไปยัง Yardsale API พร้อม Authorization จาก user (JWT)
 */
import { useCmsApi } from "./useCmsApi";

export function useAdminFetch() {
  const { user } = useAuth();
  const { endpoint } = useCmsApi();

  function authHeaders(): Record<string, string> {
    const t = user.value?.token;
    if (!t) return {};
    return { Authorization: `Bearer ${t}` };
  }

  async function adminFetch<T>(path: string, opts?: Record<string, unknown>) {
    const o = opts || {};
    const headers = {
      ...authHeaders(),
      ...(typeof o.headers === "object" && o.headers !== null
        ? (o.headers as Record<string, string>)
        : {}),
    };
    return $fetch<T>(endpoint(path), { ...o, headers });
  }

  return { adminFetch, authHeaders, endpoint };
}
