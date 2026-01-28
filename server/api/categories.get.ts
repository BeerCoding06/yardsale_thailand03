// server/api/categories.get.ts
// Fetch categories via PHP API endpoint

import * as wpUtils from '../utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      // Build PHP API URL
      const baseUrl = process.env.INTERNAL_BASE_URL || process.env.BASE_URL || 'http://localhost';
      const phpUrl = `${baseUrl}/server/api/php/getCategories.php`;
      
      // Build query string
      const queryParams = new URLSearchParams();
      if (query.parent !== undefined) queryParams.append('parent', String(query.parent));
      if (query.hide_empty !== undefined) queryParams.append('hide_empty', String(query.hide_empty));
      if (query.orderby) queryParams.append('orderby', String(query.orderby));
      if (query.order) queryParams.append('order', String(query.order));
      
      const fullUrl = queryParams.toString() ? `${phpUrl}?${queryParams.toString()}` : phpUrl;
      
      console.log('[categories] Fetching from PHP API:', fullUrl);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[categories] PHP API error:', response.status, errorText);
        return {
          productCategories: {
            nodes: []
          }
        };
      }
      
      const data = await response.json();
      
      return data;
    } catch (error: any) {
      console.error('[categories] Error:', error);
      return {
        productCategories: {
          nodes: []
        }
      };
    }
  },
  {
    maxAge: 1,
    swr: false,
  }
);
