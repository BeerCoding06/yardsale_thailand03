/**
 * Production / Nitro: โยง /yardsale-api/* → Express
 * GET/HEAD: fetch + return Response (เชื่อม upstream ชัดกว่า proxyRequest บางเคส)
 * อื่น ๆ: proxyRequest (รองรับ multipart)
 */
import {
  createError,
  defineEventHandler,
  getRequestURL,
  getRouterParam,
  proxyRequest,
} from "h3";
import {
  getYardsaleUpstreamBases,
  isLikelyNetworkError,
  yardsaleFetchFromBases,
} from "../../utils/yardsaleUpstream";

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

  const expressPath = `/api/${sub}`;

  if (method === "GET" || method === "HEAD") {
    try {
      return await yardsaleFetchFromBases(event, bases, expressPath, search);
    } catch (err: unknown) {
      const message = String(
        (err as { message?: string })?.message || "Upstream unavailable"
      );
      throw createError({
        statusCode: 502,
        statusMessage: message,
        data: {
          success: false,
          error: { message, code: "UPSTREAM_UNAVAILABLE" },
        },
      });
    }
  }

  let lastErr: unknown;
  for (const backend of bases) {
    const url = `${backend.replace(/\/$/, "")}${expressPath}${search}`;
    try {
      return await proxyRequest(event, url);
    } catch (err: unknown) {
      lastErr = err;
      if (!isLikelyNetworkError(err)) {
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
        const code =
          statusCode === 502 ? "UPSTREAM_UNAVAILABLE" : "PROXY_ERROR";
        const message = String(e?.message || "Proxy error");
        throw createError({
          statusCode,
          statusMessage: message,
          data: {
            success: false,
            error: { message, code },
          },
        });
      }
    }
  }

  const err = lastErr as { message?: string };
  const message = String(err?.message || "Upstream unavailable");
  throw createError({
    statusCode: 502,
    statusMessage: message,
    data: {
      success: false,
      error: { message, code: "UPSTREAM_UNAVAILABLE" },
    },
  });
});
