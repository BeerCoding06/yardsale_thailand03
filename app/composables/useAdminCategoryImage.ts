/**
 * รูปหมวดแอดมิน — path /uploads/... ต้องต่อ origin ของ Express
 */
export function useAdminCategoryImage() {
  const { resolveMediaUrl } = useStorefrontCatalog();

  function imageSrc(cat: any): string | null {
    const u = cat?.image?.sourceUrl || cat?.image_url;
    return u && String(u).trim() ? String(u).trim() : null;
  }

  function imageDisplayUrl(raw: string | null | undefined): string {
    if (!raw || !String(raw).trim()) return "";
    return resolveMediaUrl(String(raw).trim()) ?? String(raw).trim();
  }

  return { imageSrc, imageDisplayUrl };
}
