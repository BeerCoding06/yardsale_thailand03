/**
 * Production / Nitro: โยง /yardsale-api/* → Express
 * ใช้ proxyRequest เพื่อส่ง multipart (อัปโหลดสลิป) — ห้าม readBody + $fetch
 */
import {
  defineEventHandler,
  getRequestURL,
  getRouterParam,
  proxyRequest,
} from "h3";

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, "path");
  const sub =
    (Array.isArray(param) ? param.join("/") : String(param || "")).replace(
      /^\/+/,
      ""
    );
  const backend =
    process.env.NUXT_YARDSALE_PROXY_TARGET || "http://127.0.0.1:4000";
  const base = `${backend.replace(/\/$/, "")}/api/${sub}`;
  const reqUrl = getRequestURL(event);
  const url = `${base}${reqUrl.search || ""}`;

  try {
    return await proxyRequest(event, url);
  } catch (err: any) {
    const status =
      Number(err?.statusCode || err?.status || err?.response?.status) || 502;
    return {
      success: false,
      error: {
        message: err?.message || "Proxy error",
        code: status === 502 ? "UPSTREAM_UNAVAILABLE" : "PROXY_ERROR",
      },
    };
  }
});
