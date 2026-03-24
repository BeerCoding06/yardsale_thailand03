/**
 * รวม URL เรียก Yardsale API (Express) เมื่อตั้ง `NUXT_PUBLIC_CMS_API_BASE`
 * - เต็ม URL: http://localhost:4000/api (ข้าม origin — อาจโดน CORS / Failed to fetch)
 * - Dev แนะนำ: /yardsale-api — ผ่าน Vite proxy → 127.0.0.1:4000/api (same-origin กับ Nuxt)
 * path ที่ส่งเข้าไม่ต้องมี /api ซ้ำ
 */
export function useCmsApi() {
  const config = useRuntimeConfig();
  const rawBase = (config.public as { cmsApiBase?: string }).cmsApiBase?.trim() || "";
  const base = rawBase.replace(/\/$/, "");

  function endpoint(path: string): string {
    const p = path.replace(/^\//, "");
    if (!base) return `/api/${p}`;

    if (base.startsWith("/")) {
      const origin = import.meta.client
        ? window.location.origin
        : String(config.public.baseUrl || "http://localhost:3000").replace(/\/$/, "");
      return `${origin}${base}/${p}`;
    }

    return `${base}/${p}`;
  }

  return { endpoint, hasRemoteApi: !!base };
}
