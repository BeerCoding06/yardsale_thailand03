import { defineEventHandler, setResponseHeader } from "h3";
import { useRuntimeConfig } from "#imports";
import {
  buildAbsoluteLocalizedUrl,
  categoryQueryPath,
  normalizeSiteBaseUrl,
  productPathFromApiRow,
  SITE_LOCALES,
  sitemapUrlEntry,
} from "../../app/utils/siteSeo";
import {
  mergeYardsaleUpstreamBases,
  yardsaleFetchFromBases,
} from "../utils/yardsaleUpstream";

type ProductRow = { id?: string; name?: string; updated_at?: string; created_at?: string };
type CategoryRow = { slug?: string; name?: string };

function isoDate(d?: string | null): string | undefined {
  if (!d) return undefined;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return undefined;
  return t.toISOString().slice(0, 10);
}

async function fetchJsonFromApi(
  event: Parameters<typeof yardsaleFetchFromBases>[0],
  path: string
): Promise<unknown> {
  const pub = useRuntimeConfig(event).public as {
    cmsApiBase?: string;
    yardsaleBackendOrigin?: string;
  };
  const bases = mergeYardsaleUpstreamBases(event, pub);
  const res = await yardsaleFetchFromBases(event, bases, path, "");
  if (!res.ok) return null;
  try {
    const json = await res.json();
    const data = (json as { data?: unknown })?.data ?? json;
    return data;
  } catch {
    return null;
  }
}

async function fetchAllProducts(
  event: Parameters<typeof yardsaleFetchFromBases>[0]
): Promise<ProductRow[]> {
  const out: ProductRow[] = [];
  let page = 1;
  const pageSize = 60;
  for (;;) {
    const data = (await fetchJsonFromApi(
      event,
      `/api/products?page=${page}&page_size=${pageSize}`
    )) as { products?: ProductRow[]; pagination?: { total_pages?: number } } | null;
    const rows = Array.isArray(data?.products) ? data.products : [];
    out.push(...rows);
    const totalPages = Number(data?.pagination?.total_pages ?? 1);
    if (page >= totalPages || rows.length === 0) break;
    page += 1;
    if (page > 500) break;
  }
  return out;
}

export default defineEventHandler(async (event) => {
  const pub = useRuntimeConfig(event).public as { baseUrl?: string };
  const base = normalizeSiteBaseUrl(pub.baseUrl);
  const urls: string[] = [];
  const seen = new Set<string>();

  function add(
    path: string,
    opts?: { lastmod?: string; changefreq?: string; priority?: string }
  ) {
    for (const loc of SITE_LOCALES.map((l) =>
      buildAbsoluteLocalizedUrl(base, l.code, path)
    )) {
      if (seen.has(loc)) continue;
      seen.add(loc);
      urls.push(sitemapUrlEntry(loc, opts));
    }
  }

  const staticPages: Array<{ path: string; priority: string; changefreq: string }> = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/categories", priority: "0.9", changefreq: "weekly" },
    { path: "/guide/seller", priority: "0.6", changefreq: "monthly" },
    { path: "/guide/buyer", priority: "0.6", changefreq: "monthly" },
    { path: "/login", priority: "0.3", changefreq: "yearly" },
    { path: "/register-user", priority: "0.3", changefreq: "yearly" },
  ];
  for (const p of staticPages) {
    add(p.path, { changefreq: p.changefreq, priority: p.priority });
  }

  const catData = (await fetchJsonFromApi(event, "/api/categories")) as {
    categories?: CategoryRow[];
    productCategories?: { nodes?: CategoryRow[] };
  } | null;
  const categories =
    catData?.productCategories?.nodes ||
    catData?.categories ||
    [];
  for (const cat of categories) {
    const slug = String(cat?.slug || "").trim();
    if (!slug) continue;
    add(categoryQueryPath(slug), { changefreq: "daily", priority: "0.8" });
  }

  const products = await fetchAllProducts(event);
  for (const row of products) {
    const path = productPathFromApiRow(row);
    if (!path) continue;
    add(path, {
      lastmod: isoDate(row.updated_at || row.created_at),
      changefreq: "weekly",
      priority: "0.7",
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`;

  setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=3600, s-maxage=3600");
  return xml;
});
