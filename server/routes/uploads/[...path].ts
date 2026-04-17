/**
 * Production / Nitro: โยง /uploads/* → Express static (รูปสลิป / สินค้า)
 * คู่กับ cmsApiBase แบบ `/yardsale-api` — resolveMediaUrl ใช้ origin เดียวกับหน้าเว็บ
 */
import {
  createError,
  defineEventHandler,
  getRequestURL,
  getRouterParam,
  proxyRequest,
} from "h3";
import { getYardsaleUpstreamBases } from "../../utils/yardsaleUpstream";

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, "path");
  const sub =
    (Array.isArray(param) ? param.join("/") : String(param || "")).replace(
      /^\/+/,
      ""
    );
  const reqUrl = getRequestURL(event);
  const search = reqUrl.search || "";
  const method = String(event.method || "GET").toUpperCase();
  const bases =
    method === "GET" || method === "HEAD"
      ? getYardsaleUpstreamBases(event)
      : [getYardsaleUpstreamBases(event)[0]].filter(Boolean);

  let lastErr: unknown;
  for (const backend of bases) {
    const url = `${backend}/uploads/${sub}${search}`;
    try {
      return await proxyRequest(event, url);
    } catch (err: unknown) {
      lastErr = err;
    }
  }

  const e = lastErr as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
    message?: string;
  };
  const upstream =
    Number(e?.statusCode || e?.status || e?.response?.status) || 0;
  const statusCode =
    upstream >= 400 && upstream < 600 ? upstream : 502;
  const message = String(e?.message || "Proxy error");
  throw createError({
    statusCode,
    statusMessage: message,
    data: {
      success: false,
      error: { message, code: "UPSTREAM_UNAVAILABLE" },
    },
  });
});
