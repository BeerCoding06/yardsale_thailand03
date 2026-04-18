/**
 * เริ่ม OAuth ไปที่ Express `/auth/*`
 * - Dev: ใช้ same-origin `/auth/...` (Vite + Nitro proxy → backend)
 * - Production: ตั้ง NUXT_PUBLIC_OAUTH_API_ORIGIN เป็น origin ของ API ที่ลงทะเบียน callback ไว้
 */
export function useOAuthLogin() {
  const config = useRuntimeConfig();

  function authBase(): string {
    if (!import.meta.client) return "";
    const explicit = String(
      (config.public as { oauthApiOrigin?: string }).oauthApiOrigin || ""
    ).trim();
    if (explicit) return explicit.replace(/\/$/, "");
    return window.location.origin;
  }

  function go(path: string) {
    const b = authBase();
    if (!b) return;
    window.location.href = `${b}/auth/${path.replace(/^\//, "")}`;
  }

  return {
    startGoogle: () => go("google"),
    startFacebook: () => go("facebook"),
    startLine: () => go("line"),
  };
}
