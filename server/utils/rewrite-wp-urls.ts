/**
 * Rewrite WordPress media URLs to the public CMS URL (e.g. https://cms.yardsaleth.com).
 * Result: https://cms.yardsaleth.com/wp-content/uploads/... (โหลดตรงจาก CMS ไม่ผ่าน proxy)
 */

export function rewriteWpUrlsInObject(
  obj: unknown,
  wpBase: string,
  siteBase: string
): unknown {
  const proxyBase = siteBase.replace(/\/$/, '');
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
