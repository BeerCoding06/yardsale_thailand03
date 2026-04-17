/**
 * Production / Nitro: โยง /yardsale-api/* → Express
 * ใช้ proxyRequest เพื่อส่ง multipart (อัปโหลดสลิป) — ห้าม readBody + $fetch
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
  /** มี body หลายครั้งอาจอ่าน stream ไม่ได้ — retry เฉพาะ GET/HEAD */
  const bases =
    method === "GET" || method === "HEAD"
      ? getYardsaleUpstreamBases(event)
      : [getYardsaleUpstreamBases(event)[0]].filter(Boolean);

  let lastErr: unknown;
  for (const backend of bases) {
    const url = `${backend}/api/${sub}${search}`;
    try {
      return await proxyRequest(event, url);
    } catch (err: unknown) {
      lastErr = err;
    }
  }

  const err = lastErr as {
    statusCode?: number;
    status?: number;
    response?: { status?: number };
    message?: string;
  };
  const upstream =
    Number(err?.statusCode || err?.status || err?.response?.status) || 0;
  const statusCode =
    upstream >= 400 && upstream < 600 ? upstream : 502;
  const code = statusCode === 502 ? "UPSTREAM_UNAVAILABLE" : "PROXY_ERROR";
  const message = String(err?.message || "Proxy error");
  throw createError({
    statusCode,
    statusMessage: message,
    data: {
      success: false,
      error: { message, code },
    },
  });
});
