// server/api/search.get.ts
// Use PHP API instead of GraphQL

export default cachedEventHandler(
  async (event) => {
    try {
      const config = useRuntimeConfig();
      const baseUrl = config.baseUrl || 'http://localhost/yardsale_thailand';
      
      // Get query parameters
      const query = getQuery(event);
      const search = (query.search as string) || '';
      
      // Build PHP API URL
      const params = new URLSearchParams();
      params.set('search', search);
      params.set('limit', '6');
      
      const phpApiUrl = `${baseUrl}/server/api/php/searchProducts.php?${params.toString()}`;
      
      // Call PHP API
      const response = await fetch(phpApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let errorMessage = `PHP API error (status ${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) errorMessage = errorJson.error;
          else if (errorJson.message) errorMessage = errorJson.message;
        } catch (e) {
          /* not JSON */
          errorMessage = errorText || errorMessage;
        }
        throw createError({
          statusCode: response.status,
          message: errorMessage,
        });
      }
      
      const data = await response.json();
      
      // Ensure response has correct format
      if (!data || typeof data !== 'object') {
        return { products: { nodes: [] } };
      }
      
      // If response doesn't have products.nodes structure, wrap it
      if (!data.products) {
        return { products: { nodes: [] } };
      }
      
      if (!data.products.nodes && Array.isArray(data.products)) {
        return { products: { nodes: data.products } };
      }
      
      return data;
    } catch (error: any) {
      console.error('[search] Error:', error);
      throw createError({
        statusCode: error?.statusCode || 500,
        message: error?.message || 'Failed to search products from PHP API',
      });
    }
  },
  {
    maxAge: 0.5, // Cache for 0.5 seconds (near real-time for search)
    swr: false, // Disable SWR for immediate updates
    getKey: event => event.req.url!,
  }
);
