/**
 * สร้าง URL เรียก Yardsale API — ไม่ใช่ composable (หลีกเลี่ยงวงจร import กับ useStorefrontCatalog / useCmsApi)
 */
type PublicCmsConfig = {
  cmsApiBase?: string;
  baseUrl?: string;
};

export function hasRemoteCmsApi(publicCfg: PublicCmsConfig): boolean {
  return !!(String(publicCfg.cmsApiBase || "").trim());
}

/** แกะ `{ success, data }` จาก Express sendSuccess */
export function unwrapYardsaleResponse(res: unknown): unknown {
  const r = res as { success?: boolean; data?: unknown } | null;
  if (r && typeof r === "object" && r.success === true && r.data != null) {
    return r.data;
  }
  return res;
}

export function cmsEndpointFromPublic(
  publicCfg: PublicCmsConfig,
  path: string,
  isClient: boolean
): string {
  const base = String(publicCfg.cmsApiBase || "").trim().replace(/\/$/, "");
  const p = path.replace(/^\//, "");
  if (!base) return `/api/${p}`;

  if (base.startsWith("/")) {
    const origin = isClient
      ? typeof window !== "undefined"
        ? window.location.origin
        : ""
      : String(publicCfg.baseUrl || "http://localhost:3000").replace(/\/$/, "");
    return `${origin}${base}/${p}`;
  }

  return `${base}/${p}`;
}
