// server/api/wp-categories.get.ts
// Fetch product categories สำหรับ select ใน create product
// ลอง WooCommerce wc/v3 ก่อน; ถ้า 404 ใช้ WordPress taxonomy wp/v2/product_cat

import * as wpUtils from '../utils/wp';

const EXCLUDED = ['uncategorized', 'uncategorised', 'no category', 'no-category', 'no_category', 'unclassified', 'อื่นๆ'];

function formatAndFilter(data: any[]): any[] {
  const all = Array.isArray(data) ? data.map((cat: any) => ({
    id: cat.id,
    name: cat.name || cat.slug || '',
    slug: cat.slug || '',
    description: cat.description || '',
    count: cat.count || 0,
    parent: cat.parent || 0,
    image: cat.image ? { src: cat.image?.src || cat.image } : null,
  })) : [];
  return all.filter((cat: any) => {
    const name = (cat.name || '').trim().toLowerCase();
    const slug = (cat.slug || '').trim().toLowerCase();
    return name && !EXCLUDED.includes(name) && !EXCLUDED.includes(slug);
  });
}

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    const perPage = Math.min(100, parseInt(query.per_page as string) || 100);
    const page = parseInt(query.page as string) || 1;
    const parent = query.parent !== undefined ? parseInt(query.parent as string) : undefined;
    const params: Record<string, string | number> = {
      per_page: perPage,
      page,
      orderby: 'name',
      order: 'asc',
      ...(parent !== undefined ? { parent } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const basicAuth = wpUtils.getWpBasicAuth();
    if (basicAuth) {
      headers['Authorization'] = `Basic ${basicAuth.includes(':') ? Buffer.from(basicAuth).toString('base64') : basicAuth}`;
    }

    // 1) ลอง WooCommerce wc/v3/products/categories
    const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products/categories', params);
    const wcRes = await fetch(wcUrl, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });

    if (wcRes.ok) {
      const data = await wcRes.json();
      const categories = formatAndFilter(data);
      console.log('[wp-categories] WooCommerce API OK:', categories.length);
      return categories;
    }

    // 2) 404 หรือ error → ใช้ WordPress taxonomy product_cat (WooCommerce เก็บหมวดหมู่ที่นี่)
    console.warn('[wp-categories] WooCommerce API', wcRes.status, ', trying wp/v2/product_cat');
    const wpParams: Record<string, string | number> = { per_page: 100, page: 1, _fields: 'id,name,slug,parent' };
    const wpUrl = wpUtils.buildWpApiUrl('wp/v2/product_cat', wpParams);
    const wpRes = await fetch(wpUrl, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });

    if (!wpRes.ok) {
      console.warn('[wp-categories] product_cat also failed:', wpRes.status);
      return [];
    }

    const wpData = await wpRes.json();
    const categories = formatAndFilter(wpData);
    console.log('[wp-categories] WordPress product_cat OK:', categories.length);
    return categories;
  } catch (error: any) {
    console.error('[wp-categories] Error:', error?.message || error);
    return [];
  }
});
