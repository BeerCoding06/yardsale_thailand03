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

export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, "path");
  const sub =
    (Array.isArray(param) ? param.join("/") : String(param || "")).replace(
      /^\/+/,
      ""
    );
  const backend =
    process.env.NUXT_YARDSALE_PROXY_TARGET || "http://127.0.0.1:4000";
  const base = `${backend.replace(/\/$/, "")}/uploads/${sub}`;
  const reqUrl = getRequestURL(event);
  const url = `${base}${reqUrl.search || ""}`;

  try {
    return await proxyRequest(event, url);
  } catch (err: unknown) {
    const e = err as {
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
  }
});
