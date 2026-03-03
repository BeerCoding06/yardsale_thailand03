/**
 * Rewrite WordPress media URLs to go through our domain (/wordpress proxy).
 * Fixes broken images: WP returns http://157.85.98.150:8080/... which causes
 * mixed content (HTTPS page loading HTTP) and may be blocked by browser.
 */

export function rewriteWpUrlsInObject(
  obj: unknown,
  wpBase: string,
  siteBase: string
): unknown {
  const proxyBase = siteBase.replace(/\/$/, '') + '/wordpress';
  const wpBaseNorm = wpBase.replace(/\/$/, '');

  function rewrite(value: unknown): unknown {
    if (typeof value === 'string') {
      if (value.startsWith(wpBaseNorm) || value.startsWith(wpBase)) {
        return value.replace(wpBaseNorm, proxyBase).replace(wpBase.replace(/\/$/, ''), proxyBase);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(rewrite);
    }
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = rewrite(v);
      }
      return out;
    }
    return value;
  }

  return rewrite(obj);
}
