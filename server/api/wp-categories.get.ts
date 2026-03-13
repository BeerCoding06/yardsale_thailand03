// server/api/wp-categories.get.ts
// Fetch product categories from WooCommerce REST API (สำหรับ select ใน create product)
// รองรับทั้ง Basic Auth และ consumer_key/consumer_secret

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event: any) => {
  try {
    const query = getQuery(event);
    
    const perPage = query.per_page ? parseInt(query.per_page as string) : 100;
    const page = query.page ? parseInt(query.page as string) : 1;
    const parent = query.parent !== undefined ? parseInt(query.parent as string) : undefined;
    const search = query.search as string | undefined;
    const orderby = (query.orderby as string) || 'name';
    const order = (query.order as string) || 'asc';
    
    const params: Record<string, string | number> = {
      per_page: perPage,
      page: page,
      orderby: orderby === 'name' ? 'name' : 'id',
      order: order.toLowerCase() === 'desc' ? 'desc' : 'asc',
      ...(parent !== undefined ? { parent: parent } : {}),
      ...(search ? { search: search } : {})
    };
    
    // ลองใช้ WooCommerce URL ที่มี consumer_key/consumer_secret ก่อน (ไม่ต้องมี Basic Auth)
    const apiUrl = wpUtils.buildWcApiUrl('wc/v3/products/categories', params);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    const basicAuth = wpUtils.getWpBasicAuth();
    if (basicAuth) {
      const authString = basicAuth.includes(':') ? Buffer.from(basicAuth).toString('base64') : basicAuth;
      headers['Authorization'] = `Basic ${authString}`;
    }
    
    console.log('[wp-categories] Fetching from WooCommerce API');
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[wp-categories] WooCommerce API error:', response.status, errorText);
      console.warn('[wp-categories] Returning empty array');
      return [];
    }
    
    const data = await response.json();
    
    // Format categories for compatibility with FormCreateProducts
    // WooCommerce API returns array of category objects with: id, name, slug, description, count, image, parent
    const allCategories = Array.isArray(data) ? data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      count: cat.count || 0,
      parent: cat.parent || 0,
      image: cat.image ? { src: cat.image.src || cat.image } : null,
    })) : [];
    
    // Filter out "Uncategorized" or "No Category" categories
    const categories = allCategories.filter((cat: any) => {
      const name = (cat.name || '').trim().toLowerCase();
      const slug = (cat.slug || '').trim().toLowerCase();
      
      // Exclude categories with these names/slugs
      const excludedNames = [
        'uncategorized',
        'uncategorised',
        'no category',
        'no-category',
        'no_category',
        'unclassified',
        'อื่นๆ',
        'อื่นๆ',
      ];
      
      return !excludedNames.includes(name) && !excludedNames.includes(slug);
    });
    
    console.log('[wp-categories] Successfully fetched', allCategories.length, 'categories, filtered to', categories.length, 'categories (excluded uncategorized)');
    
    return categories;
  } catch (error: any) {
    console.error('[wp-categories] Error:', error);
    return [];
  }
});
