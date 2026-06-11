import { defineEventHandler } from "h3";
import { useRuntimeConfig } from "#imports";
import {
  mergeYardsaleUpstreamBases,
  yardsaleFetchFromBases,
} from "../../utils/yardsaleUpstream";

/** ตรวจว่า Nitro proxy ไป Express ได้หรือไม่ (ใช้ debug 502 บน production) */
export default defineEventHandler(async (event) => {
  const pub = useRuntimeConfig(event).public as {
    cmsApiBase?: string;
    yardsaleBackendOrigin?: string;
  };
  const bases = mergeYardsaleUpstreamBases(event, pub);
  const results: Array<{ base: string; ok: boolean; status: number }> = [];

  for (const base of bases) {
    if (!base) continue;
    try {
      const res = await yardsaleFetchFromBases(
        event,
        [base],
        "/api/products",
        "?page=1&page_size=1"
      );
      results.push({ base, ok: res.ok, status: res.status });
    } catch {
      results.push({ base, ok: false, status: 0 });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return {
    success: anyOk,
    data: {
      ok: anyOk,
      bases_tried: results,
      hint: anyOk
        ? null
        : "Set NUXT_YARDSALE_PROXY_TARGET or NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN=https://api.yardsaleth.com on frontend container",
    },
  };
});
