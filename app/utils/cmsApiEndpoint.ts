/**
 * สร้าง URL เรียก Yardsale API — ไม่ใช่ composable (หลีกเลี่ยงวงจร import กับ useStorefrontCatalog / useCmsApi)
 */
type PublicCmsConfig = {
  cmsApiBase?: string;
  baseUrl?: string;
};

function stripCommonSubdomain(hostname: string): string {
  return String(hostname || "")
    .toLowerCase()
    .replace(/^(www|api)\./, "");
}

/**
 * Production hardening:
 * ถ้า cmsApiBase เป็นโดเมน `api.*` ที่อยู่ไซต์เดียวกับหน้าเว็บ (`www.*`) ให้ยิงผ่าน same-origin `/yardsale-api`
 * เพื่อลดปัญหา Caddy/edge คืน 502 แล้วเบราว์เซอร์ฟ้อง CORS ซ้ำ.
 */
function resolveClientCmsBase(base: string, isClient: boolean): string {
  if (!isClient || typeof window === "undefined" || !/^https?:\/\//i.test(base)) {
    return base;
  }
  try {
    const current = new URL(window.location.origin);
    const target = new URL(base);
    const currentRoot = stripCommonSubdomain(current.hostname);
    const targetRoot = stripCommonSubdomain(target.hostname);
    const isSameSite = !!currentRoot && currentRoot === targetRoot;
    if (isSameSite && target.hostname.toLowerCase().startsWith("api.")) {
      return "/yardsale-api";
    }
  } catch {
    // keep original base on parse errors
  }
  return base;
}

export function hasRemoteCmsApi(publicCfg: PublicCmsConfig): boolean {
  return !!(String(publicCfg.cmsApiBase || "").trim());
}

/**
 * แกะ `{ success, data }` จาก Express sendSuccess
 * รองรับห่อซ้อน (เช่น data ข้างในยังเป็น { success, data }) จำกัดความลึกเพื่อกันวงซ้ำ
 */
export function unwrapYardsaleResponse(res: unknown): unknown {
  let current = res;
  const maxDepth = 8;
  for (let i = 0; i < maxDepth; i++) {
    const r = current as { success?: boolean; data?: unknown } | null;
    if (!r || typeof r !== "object" || Array.isArray(r)) break;
    if (r.success !== true) break;
    if (r.data == null) break;
    if (typeof r.data !== "object") break;
    current = r.data;
  }
  return current;
}

/** Payload หลัง unwrap ที่ Express ส่ง success: false */
export function yardsaleBodyIsFailure(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as { success?: boolean }).success === false
  );
}

/** ข้อความจาก body ของ Express sendError หรือ proxy error */
export function messageFromYardsaleBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fallback;
  const o = body as Record<string, unknown>;
  const err = o.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    const m = String((err as { message: string }).message).trim();
    if (m) return m;
  }
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  return fallback;
}

export function cmsEndpointFromPublic(
  publicCfg: PublicCmsConfig,
  path: string,
  isClient: boolean
): string {
  const rawBase = String(publicCfg.cmsApiBase || "").trim().replace(/\/$/, "");
  const base = resolveClientCmsBase(rawBase, isClient);
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
