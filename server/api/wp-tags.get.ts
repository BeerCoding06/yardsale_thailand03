// server/api/wp-tags.get.ts
// Fetch product tags สำหรับ select ใน create product
// ลอง WooCommerce wc/v3 ก่อน; ถ้า 404 ใช้ WordPress taxonomy wp/v2/product_tag

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    const perPage = Math.min(100, parseInt(query.per_page as string) || 100);
    const page = parseInt(query.page as string) || 1;
    const params: Record<string, string | number> = {
      per_page: perPage,
      page,
      orderby: 'name',
      order: 'asc',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const basicAuth = wpUtils.getWpBasicAuth();
    if (basicAuth) {
      headers['Authorization'] = `Basic ${basicAuth.includes(':') ? Buffer.from(basicAuth).toString('base64') : basicAuth}`;
    }

    // 1) ลอง WooCommerce wc/v3/products/tags
    const wcUrl = wpUtils.buildWcApiUrl('wc/v3/products/tags', params);
    const wcRes = await fetch(wcUrl, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });

    if (wcRes.ok) {
      const data = await wcRes.json();
      const tags = Array.isArray(data) ? data.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description || '',
        count: tag.count || 0,
      })) : [];
      console.log('[wp-tags] WooCommerce API OK:', tags.length);
      return tags;
    }

    // 2) 404 หรือ error → ใช้ WordPress taxonomy product_tag
    console.warn('[wp-tags] WooCommerce API', wcRes.status, ', trying wp/v2/product_tag');
    const wpParams: Record<string, string | number> = { per_page: 100, page: 1, _fields: 'id,name,slug' };
    const wpUrl = wpUtils.buildWpApiUrl('wp/v2/product_tag', wpParams);
    const wpRes = await fetch(wpUrl, { method: 'GET', headers, signal: AbortSignal.timeout(15000) });

    if (!wpRes.ok) {
      console.warn('[wp-tags] product_tag also failed:', wpRes.status);
      return [];
    }

    const wpData = await wpRes.json();
    const tags = Array.isArray(wpData) ? wpData.map((tag: any) => ({
      id: tag.id,
      name: tag.name || tag.slug || '',
      slug: tag.slug || '',
      description: '',
      count: 0,
    })) : [];
    console.log('[wp-tags] WordPress product_tag OK:', tags.length);
    return tags;
  } catch (error: any) {
    console.error('[wp-tags] Error:', error?.message || error);
    return [];
  }
});
