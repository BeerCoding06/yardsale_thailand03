/**
 * Dev / same-origin: โยง /yardsale-api/* → Express (พอร์ต 4000)
 * เพราะ request บางกรณีไป Nitro ก่อน Vite proxy — ไม่มี route เดิมจึง 500
 */
import {
  defineEventHandler,
  getRequestURL,
  getRouterParam,
  getHeader,
  readBody,
  setResponseStatus,
  setHeader,
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

  const method = event.method || "GET";
  const headers: Record<string, string> = {};
  const ct = getHeader(event, "content-type");
  if (ct) headers["content-type"] = ct;
  const auth = getHeader(event, "authorization");
  if (auth) headers.authorization = auth;

  let body: unknown;
  if (!["GET", "HEAD"].includes(method)) {
    try {
      body = await readBody(event);
    } catch {
      body = undefined;
    }
  }

  try {
    return await $fetch(url, { method, headers, body });
  } catch (err: any) {
    const status = Number(err?.statusCode || err?.status || err?.response?.status) || 502;
    const data = err?.data ?? err?.response?._data;
    setResponseStatus(event, status);
    setHeader(event, "content-type", "application/json");
    if (data && typeof data === "object") {
      return data;
    }
    return {
      success: false,
      error: {
        message: err?.message || "Proxy error",
        code: status === 502 ? "UPSTREAM_UNAVAILABLE" : "PROXY_ERROR",
      },
    };
  }
});
