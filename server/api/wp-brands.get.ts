// server/api/wp-brands.get.ts
// Fetch product brands: try WordPress REST API (product_brand), then DB fallback

import * as wpUtils from '../utils/wp';
import { executePhpScript } from '../utils/php-executor';

function formatBrands(data: unknown): Array<{ id: number; name: string; slug: string; description: string; count: number }> {
  return Array.isArray(data)
    ? data.map((brand: any) => ({
        id: brand.id ?? 0,
        name: brand.name ?? '',
        slug: brand.slug ?? '',
        description: brand.description ?? '',
        count: brand.count ?? 0,
      }))
    : [];
}

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'asc';

    const params: Record<string, string | number | boolean> = {
      per_page: perPage,
      page,
      orderby: orderby === 'name' ? 'name' : 'id',
      order: order.toLowerCase() === 'desc' ? 'desc' : 'asc',
      hide_empty: false,
      ...(search ? { search } : {}),
    };

    const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product_brand', params);
    const headers = wpUtils.getWpApiHeaders(true, false);

    if (headers['Authorization']) {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: headers['Authorization'] },
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = await response.json();
        const brands = formatBrands(data);
        if (brands.length > 0) {
          console.log('[wp-brands] Fetched', brands.length, 'brands from REST API');
          return brands;
        }
      }
      console.warn('[wp-brands] REST API returned', response.status, '- trying DB fallback');
    } else {
      console.warn('[wp-brands] WP_BASIC_AUTH not set - trying DB fallback');
    }

    // DB fallback: pass DB env so PHP can connect (same as login/categories)
    const env: Record<string, string> = {};
    if (process.env.DB_HOST) env.DB_HOST = process.env.DB_HOST;
    if (process.env.WP_DB_NAME) env.WP_DB_NAME = process.env.WP_DB_NAME;
    if (process.env.WP_DB_USER) env.WP_DB_USER = process.env.WP_DB_USER;
    if (process.env.WP_DB_PASSWORD) env.WP_DB_PASSWORD = process.env.WP_DB_PASSWORD;
    if (process.env.WP_TABLE_PREFIX) env.WP_TABLE_PREFIX = process.env.WP_TABLE_PREFIX;
    const raw = await executePhpScript({
      script: 'getBrandsFromDb.php',
      method: 'GET',
      env,
    });
    const brands = formatBrands(raw);
    console.log('[wp-brands] Fetched', brands.length, 'brands from DB');
    return brands;
  } catch (error: any) {
    console.error('[wp-brands] Error:', error);
    return [];
  }
});
