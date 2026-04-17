import type { H3Event } from "h3";

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
 * รายการ URL ฐานของ Express ที่ Nitro จะลอง proxy ตามลำดับ
 * ใช้แค่ process.env — หลีกเลี่ยงปัญหา runtimeConfig ใน bundle Nitro บางเคส
 */
export function getYardsaleUpstreamBases(_event?: H3Event): string[] {
  const fromEnv = String(process.env.NUXT_YARDSALE_PROXY_TARGET ?? "").trim();
  if (process.env.NODE_ENV === "production") {
    return dedupeBases([
      fromEnv,
      "http://backend:4000",
      "http://host.docker.internal:4000",
      "http://172.17.0.1:4000",
    ]);
  }
  return dedupeBases([fromEnv, "http://127.0.0.1:4000"]);
}

/** ค่าแรกที่ใช้ได้ (สำหรับ log / header ฯลฯ) */
export function getYardsaleUpstreamBase(event?: H3Event): string {
  const bases = getYardsaleUpstreamBases(event);
  return bases[0] || "http://127.0.0.1:4000";
}
