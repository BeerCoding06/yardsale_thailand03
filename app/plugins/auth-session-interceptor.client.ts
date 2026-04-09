/**
 * ครอบ global $fetch (หลัง mock-api ถ้ามี) — JWT หมดอายุ / ไม่ valid → ล้าง session แล้วไป login
 * ไม่แตะคำขอ POST .../login (รหัสผ่านผิดมักได้ 401)
 */
export default defineNuxtPlugin({
  name: "auth-session-interceptor",
  enforce: "post",
  setup() {
    const inner = globalThis.$fetch;

    function isLoginFetchRequest(request: unknown): boolean {
      try {
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost";
        let href = "";
        if (typeof request === "string") href = request;
        else if (request instanceof Request) href = request.url;
        else if (request && typeof request === "object") {
          const r = request as Record<string, unknown>;
          if (typeof r.url === "string") href = r.url;
          else if (typeof r.path === "string") href = r.path;
          else return false;
        } else return false;
        const u = new URL(href, origin);
        const parts = u.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] === "login";
      } catch {
        return false;
      }
    }

    globalThis.$fetch = (async (request: any, opts?: Record<string, unknown>) => {
      try {
        return await inner(request, opts);
      } catch (err: any) {
        const status =
          err?.statusCode ?? err?.status ?? err?.response?.status;
        if (status === 401 && !isLoginFetchRequest(request)) {
          const { sessionExpiredRedirect } = useAuth();
          await sessionExpiredRedirect();
        }
        throw err;
      }
    }) as typeof globalThis.$fetch;
  },
});
