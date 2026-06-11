import { defineEventHandler, setResponseHeader } from "h3";
import { useRuntimeConfig } from "#imports";
import { normalizeSiteBaseUrl } from "../../app/utils/siteSeo";

export default defineEventHandler((event) => {
  const pub = useRuntimeConfig(event).public as { baseUrl?: string };
  const base = normalizeSiteBaseUrl(pub.baseUrl);

  const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /my-orders
Disallow: /my-products
Disallow: /seller-orders
Disallow: /wallet
Disallow: /my-wallet
Disallow: /profile
Disallow: /checkout/
Disallow: /order/
Disallow: /chat
Disallow: /auth/

Sitemap: ${base}/sitemap.xml
`;

  setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=86400");
  return body;
});
