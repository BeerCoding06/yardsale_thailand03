import {
  buildAbsoluteLocalizedUrl,
  hreflangLinkTags,
  normalizeSiteBaseUrl,
  SITE_LOCALES,
} from "~/utils/siteSeo";

/**
 * Site-wide SEO helpers: canonical base, hreflang, Organization / WebSite JSON-LD.
 */
export function useSiteSeo() {
  const config = useRuntimeConfig();
  const { site } = useAppConfig();
  const route = useRoute();
  const { locale } = useI18n();

  const siteBaseUrl = computed(() =>
    normalizeSiteBaseUrl(config.public?.baseUrl as string | undefined)
  );

  const siteName = computed(() => String(site?.name || "YardsaleThailand"));

  const siteDescription = computed(() => {
    const d = String(site?.description || "").trim();
    if (d && d !== siteName.value) return d;
    return locale.value === "th"
      ? "ตลาดซื้อขายของมือสองออนไลน์ในไทย — เฟอร์นิเจอร์ เครื่องใช้ไฟฟ้า เสื้อผ้า ราคาดี จัดส่งทั่วไทย"
      : "Thailand's second-hand marketplace — buy and sell used furniture, electronics, fashion and more.";
  });

  /** Path without locale prefix (e.g. /product/uuid, /categories). */
  function pathWithoutLocalePrefix(): string {
    const p = route.path || "/";
    const codes = SITE_LOCALES.map((l) => l.code).filter((c) => c !== "th");
    for (const code of codes) {
      const prefix = `/${code}`;
      if (p === prefix) return "/";
      if (p.startsWith(`${prefix}/`)) return p.slice(prefix.length) || "/";
    }
    return p;
  }

  function canonicalUrl(path?: string): string {
    const inner = path ?? pathWithoutLocalePrefix();
    return buildAbsoluteLocalizedUrl(siteBaseUrl.value, locale.value, inner);
  }

  function hreflangLinks(path?: string) {
    return hreflangLinkTags(siteBaseUrl.value, path ?? pathWithoutLocalePrefix());
  }

  function useHreflangHead(path?: string) {
    useHead({
      link: hreflangLinks(path),
    });
  }

  function organizationJsonLd() {
    const url = siteBaseUrl.value;
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${url}/#organization`,
          name: siteName.value,
          url,
          logo: `${url}/logo.png`,
          sameAs: ["https://twitter.com/zhatlen"],
        },
        {
          "@type": "WebSite",
          "@id": `${url}/#website`,
          url,
          name: siteName.value,
          description: siteDescription.value,
          publisher: { "@id": `${url}/#organization` },
          inLanguage: SITE_LOCALES.map((l) => l.iso),
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${url}/?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    };
  }

  return {
    siteBaseUrl,
    siteName,
    siteDescription,
    canonicalUrl,
    hreflangLinks,
    useHreflangHead,
    organizationJsonLd,
    pathWithoutLocalePrefix,
  };
}
