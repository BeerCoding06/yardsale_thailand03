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
import { useRuntimeConfig } from "#imports";

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, "path");
  const sub =
    (Array.isArray(param) ? param.join("/") : String(param || "")).replace(
      /^\/+/,
      ""
    );
  const cfg = useRuntimeConfig(event);
  const backend =
    String(cfg.yardsaleProxyTarget || "").trim() ||
    process.env.NUXT_YARDSALE_PROXY_TARGET ||
    "http://127.0.0.1:4000";
  const base = `${backend.replace(/\/$/, "")}/api/${sub}`;
  const reqUrl = getRequestURL(event);
  const url = `${base}${reqUrl.search || ""}`;

  try {
    return await proxyRequest(event, url);
  } catch (err: any) {
    const upstream =
      Number(err?.statusCode || err?.status || err?.response?.status) || 0;
    const statusCode =
      upstream >= 400 && upstream < 600 ? upstream : 502;
    const code =
      statusCode === 502 ? "UPSTREAM_UNAVAILABLE" : "PROXY_ERROR";
    const message = String(err?.message || "Proxy error");
    throw createError({
      statusCode,
      statusMessage: message,
      data: {
        success: false,
        error: { message, code },
      },
    });
  }
});
