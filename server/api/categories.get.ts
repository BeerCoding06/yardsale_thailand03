// server/api/categories.get.ts
// Fetch product categories from WordPress REST API

import * as wpUtils from '~/server/utils/wp';

export default cachedEventHandler(
  async (event) => {
    try {
      const query = getQuery(event);
      
      // Get query parameters
      const parent = parseInt(query.parent as string || '0');
      const hideEmpty = query.hide_empty !== 'false';
      const orderby = (query.orderby as string) || 'name';
      const order = (query.order as string) || 'ASC';
      const perPage = 100;
      
      // Build query parameters
      const params: Record<string, string | number> = {
        per_page: perPage,
        page: 1,
        orderby: orderby,
        order: order.toLowerCase(),
        ...(hideEmpty ? { hide_empty: '1' } : {}),
        ...(parent !== undefined ? { parent: parent } : {})
      };
      
      // Use WordPress REST API endpoint
      const apiUrl = wpUtils.buildWpApiUrl('wp/v2/product_cat', params);
      
      // Use utility function for headers
      const headers = wpUtils.getWpApiHeaders(true, false);
      
      console.log('[categories] Fetching from WordPress API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[categories] WordPress API error:', response.status, errorText);
        return {
          productCategories: {
            nodes: []
          }
        };
      }
      
      let data = await response.json();
      
      // Format categories to match expected structure
      const formattedCategories = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (category: any) => {
          // Get category image
          let imageUrl: string | null = null;
          if (category.image) {
            imageUrl = category.image;
          } else if (category._links?.['wp:attachment']?.[0]?.href) {
            // Try to fetch image from attachment link
            try {
              const imageResponse = await fetch(category._links['wp:attachment'][0].href, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(5000),
              });
              if (imageResponse.ok) {
                const images = await imageResponse.json();
                if (Array.isArray(images) && images.length > 0) {
                  imageUrl = images[0].source_url || null;
                }
              }
            } catch (e) {
              console.warn('[categories] Error fetching category image:', e);
            }
          }
          
          // Get children categories
          const children: any[] = [];
          if (category.count > 0 || !hideEmpty) {
            // Fetch children if needed
            try {
              const childrenUrl = wpUtils.buildWpApiUrl('wp/v2/product_cat', {
                parent: category.id,
                per_page: 100,
                ...(hideEmpty ? { hide_empty: '1' } : {})
              });
              const childrenResponse = await fetch(childrenUrl, {
                method: 'GET',
                headers,
                signal: AbortSignal.timeout(10000),
              });
              if (childrenResponse.ok) {
                const childrenData = await childrenResponse.json();
                children.push(...(Array.isArray(childrenData) ? childrenData : []));
              }
            } catch (e) {
              console.warn('[categories] Error fetching children:', e);
            }
          }
          
          // Get products count (if needed)
          const products: any[] = [];
          // WordPress REST API doesn't provide products in category response
          // We'll leave it empty for now
          
          return {
            id: category.id,
            databaseId: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            image: imageUrl ? { sourceUrl: imageUrl } : null,
            parent: category.parent || null,
            count: category.count || 0,
            children: {
              nodes: children.map((child: any) => ({
                id: child.id,
                databaseId: child.id,
                name: child.name,
                slug: child.slug,
                description: child.description || '',
                image: null,
                parent: child.parent || null,
                count: child.count || 0,
              }))
            },
            products: {
              nodes: products
            }
          };
        })
      );
      
      console.log('[categories] Formatted categories:', formattedCategories.length);
      
      return {
        productCategories: {
          nodes: formattedCategories
        }
      };
    } catch (error: any) {
      console.error('[categories] Error:', error);
      // Return empty data instead of throwing error to keep the app working
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
