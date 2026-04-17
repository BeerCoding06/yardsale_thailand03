import type { H3Event } from "h3";
import { useRuntimeConfig } from "#imports";

/**
 * URL ฐานของ Express สำหรับ Nitro proxy — ห้ามคืนค่าว่าง (จะทำให้ไป 127.0.0.1 แล้ว 502 ใน Docker)
 */
export function getYardsaleUpstreamBase(event: H3Event): string {
  const cfg = useRuntimeConfig(event) as { yardsaleProxyTarget?: string };
  const fromCfg = String(cfg.yardsaleProxyTarget ?? "").trim();
  const fromEnv = String(process.env.NUXT_YARDSALE_PROXY_TARGET ?? "").trim();
  const chosen = fromCfg || fromEnv;
  if (chosen) return chosen.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    // Compose service name — ถ้า split deploy ให้ตั้ง NUXT_YARDSALE_PROXY_TARGET เอง
    return "http://backend:4000";
  }
  return "http://127.0.0.1:4000";
}
