/** Shared SEO helpers (safe for server + client — no Vue imports). */

export const SITE_LOCALES = [
  { code: "th", iso: "th-TH", default: true },
  { code: "en", iso: "en-GB" },
  { code: "nb", iso: "nb-NO" },
  { code: "nl", iso: "nl-NL" },
  { code: "de", iso: "de-DE" },
] as const;

export type SiteLocaleCode = (typeof SITE_LOCALES)[number]["code"];

export function normalizeSiteBaseUrl(raw?: string | null): string {
  const s = String(raw || process.env.NUXT_PUBLIC_BASE_URL || "https://www.yardsaleth.com")
    .trim()
    .replace(/\/$/, "");
  return s || "https://www.yardsaleth.com";
}

/** i18n prefix_except_default: Thai has no prefix. */
export function localePathFor(localeCode: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const code = String(localeCode || "th").toLowerCase();
  if (code === "th" || code === "default") {
    return p === "/" ? "/" : p;
  }
  if (p === "/") return `/${code}`;
  return `/${code}${p}`;
}

export function buildAbsoluteLocalizedUrl(
  baseUrl: string,
  localeCode: string,
  path: string
): string {
  const base = normalizeSiteBaseUrl(baseUrl);
  const localized = localePathFor(localeCode, path);
  return localized === "/" ? `${base}/` : `${base}${localized}`;
}

export function hreflangLinkTags(
  baseUrl: string,
  path: string
): Array<{ rel: "alternate"; hreflang: string; href: string }> {
  const links = SITE_LOCALES.map((l) => ({
    rel: "alternate" as const,
    hreflang: l.iso,
    href: buildAbsoluteLocalizedUrl(baseUrl, l.code, path),
  }));
  links.push({
    rel: "alternate",
    hreflang: "x-default",
    href: buildAbsoluteLocalizedUrl(baseUrl, "th", path),
  });
  return links;
}

export function slugifyProductName(name: string): string {
  const s = String(name || "item").trim().toLowerCase();
  const out = s.replace(/[^a-z0-9\u0E00-\u0E7F]+/gi, "-").replace(/^-+|-+$/g, "");
  return out || "item";
}

export function productPathFromApiRow(row: { id?: string; name?: string }): string {
  const id = String(row?.id || "").trim();
  if (!id) return "";
  return `/product/${id}`;
}

export function categoryQueryPath(slug: string): string {
  const s = String(slug || "").trim();
  if (!s) return "/";
  return `/?category=${encodeURIComponent(s)}`;
}

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sitemapUrlEntry(
  loc: string,
  opts?: { lastmod?: string; changefreq?: string; priority?: string }
): string {
  const lastmod = opts?.lastmod
    ? `<lastmod>${escapeXml(opts.lastmod)}</lastmod>`
    : "";
  const changefreq = opts?.changefreq
    ? `<changefreq>${escapeXml(opts.changefreq)}</changefreq>`
    : "";
  const priority = opts?.priority
    ? `<priority>${escapeXml(opts.priority)}</priority>`
    : "";
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod}${changefreq}${priority}</url>`;
}
