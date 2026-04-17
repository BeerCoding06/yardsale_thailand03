import type { H3Event } from "h3";
import { getRequestHeaders } from "h3";

function dedupeBases(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const s = String(u || "")
      .trim()
      .replace(/\/$/, "");
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * ฐาน public ของ Express จาก env ที่ deploy มักมีอยู่แล้ว (เช่น https://api.yardsaleth.com)
 * ใช้เป็น fallback สุดท้ายเมื่อ http://backend:4000 ใน Docker เชื่อมไม่ได้
 */
function publicExpressOriginFromNuxtEnv(): string | null {
  const cms = String(process.env.NUXT_PUBLIC_CMS_API_BASE ?? "").trim();
  if (cms && /^https?:\/\//i.test(cms)) {
    try {
      return new URL(cms).origin.replace(/\/$/, "");
    } catch {
      /* ignore */
    }
  }
  const origin = String(
    process.env.NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN ?? ""
  ).trim();
  if (origin && /^https?:\/\//i.test(origin)) {
    try {
      return new URL(origin).origin.replace(/\/$/, "");
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * รายการ URL ฐานของ Express ที่ Nitro จะลอง proxy ตามลำดับ
 * - `YARDSALE_BACKEND_INTERNAL_URL` = URL เต็มฐาน (เช่น http://ชื่อ-container:4000) สำหรับ Dokploy แบบแยก stack
 * - `NUXT_YARDSALE_PROXY_TARGET` = ฐานเดียวกัน (เช่น http://backend:4000)
 * - สุดท้าย: origin จาก `NUXT_PUBLIC_CMS_API_BASE` / `NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN` (https://api…)
 *   กรณี stack ภายในเชื่อมกันไม่ได้ แต่ API สาธารณะยังใช้ได้จาก container
 */
export function getYardsaleUpstreamBases(_event?: H3Event): string[] {
  const fullInternal = String(
    process.env.YARDSALE_BACKEND_INTERNAL_URL ?? ""
  ).trim();
  const fromEnv = String(process.env.NUXT_YARDSALE_PROXY_TARGET ?? "").trim();
  const publicOrigin = publicExpressOriginFromNuxtEnv();
  if (process.env.NODE_ENV === "production") {
    return dedupeBases([
      fullInternal,
      fromEnv,
      "http://backend:4000",
      "http://host.docker.internal:4000",
      "http://172.17.0.1:4000",
      ...(publicOrigin ? [publicOrigin] : []),
    ]);
  }
  return dedupeBases([
    fullInternal,
    fromEnv,
    "http://127.0.0.1:4000",
    ...(publicOrigin ? [publicOrigin] : []),
  ]);
}

export function getYardsaleUpstreamBase(event?: H3Event): string {
  const bases = getYardsaleUpstreamBases(event);
  return bases[0] || "http://127.0.0.1:4000";
}

/** อ่าน https origin จาก runtime public (ค่าที่ Nuxt hydrate ได้แม้ process.env ใน Nitro ไม่มี NUXT_PUBLIC_*) */
export function publicOriginsFromPublicConfig(
  pub: { cmsApiBase?: string; yardsaleBackendOrigin?: string } | null | undefined
): string[] {
  const raw: string[] = [];
  const cms = String(pub?.cmsApiBase ?? "").trim();
  if (/^https?:\/\//i.test(cms)) {
    try {
      raw.push(new URL(cms).origin.replace(/\/$/, ""));
    } catch {
      /* ignore */
    }
  }
  const yo = String(pub?.yardsaleBackendOrigin ?? "").trim();
  if (/^https?:\/\//i.test(yo)) {
    try {
      raw.push(new URL(yo).origin.replace(/\/$/, ""));
    } catch {
      /* ignore */
    }
  }
  return dedupeBases(raw);
}

export function mergeYardsaleUpstreamBases(
  event: H3Event,
  publicCfg?: { cmsApiBase?: string; yardsaleBackendOrigin?: string } | null
): string[] {
  return dedupeBases([
    ...getYardsaleUpstreamBases(event),
    ...publicOriginsFromPublicConfig(publicCfg),
  ]);
}

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "te",
  "proxy-connection",
  "proxy-authorization",
]);

export function buildUpstreamFetchHeaders(event: H3Event): Headers {
  const headers = new Headers();
  const incoming = getRequestHeaders(event);
  for (const [rawKey, rawVal] of Object.entries(incoming)) {
    if (rawVal === undefined || rawVal === null) continue;
    const lk = rawKey.toLowerCase();
    if (HOP_BY_HOP.has(lk)) continue;
    const val = Array.isArray(rawVal) ? rawVal.join(", ") : String(rawVal);
    headers.set(rawKey, val);
  }
  return headers;
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (!err) return true;
  const e = err as {
    cause?: { code?: string };
    code?: string;
    message?: string;
  };
  const code = String(e.cause?.code || e.code || "");
  const msg = String(e.message || "").toLowerCase();
  return (
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(
      code
    ) ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("connect")
  );
}

/**
 * GET/HEAD ไป Express — ใช้ fetch แล้ว return Web Response (H3/Nitro รองรับ)
 * retry เฉพาะเมื่อเป็น network error
 */
export async function yardsaleFetchFromBases(
  event: H3Event,
  bases: string[],
  expressRelPath: string,
  search: string
): Promise<Response> {
  const headers = buildUpstreamFetchHeaders(event);
  const method = String(event.method || "GET").toUpperCase();
  const path = expressRelPath.startsWith("/")
    ? expressRelPath
    : `/${expressRelPath}`;
  let lastErr: unknown;
  for (const base of bases) {
    const url = `${base.replace(/\/$/, "")}${path}${search}`;
    try {
      return await fetch(url, {
        method,
        headers,
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      lastErr = e;
      if (!isLikelyNetworkError(e)) throw e;
    }
  }
  throw lastErr;
}
