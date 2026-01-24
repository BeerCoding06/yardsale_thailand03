// server/api/product.get.ts
// Use PHP API instead of GraphQL

export default cachedEventHandler(
  async (event) => {
    try {
      const config = useRuntimeConfig();
      // Use internal port 8080 for container communication
      // Nginx is on port 8080 for WordPress/PHP API routing
      const baseUrl = 'http://localhost:8080';
      
      // Get query parameters
      const query = getQuery(event);
      const slug = query.slug as string | undefined;
      const sku = query.sku as string | undefined;
      
      if (!slug && !sku) {
        throw createError({
          statusCode: 400,
          message: 'slug or sku is required',
        });
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (slug) params.append('slug', slug);
      if (sku) params.append('sku', sku);
      
      const phpApiUrl = `${baseUrl}/server/api/php/getProduct.php?${params.toString()}`;
      
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
        } catch (e) {
          /* not JSON */
        }
        throw createError({
          statusCode: response.status,
          message: errorMessage,
        });
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('[product] Error:', error);
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Failed to fetch product',
      });
    }
  },
  {
    maxAge: 1, // Cache for 1 second (real-time)
    swr: false, // Disable SWR for immediate updates
    getKey: event => event.req.url!,
  }
);
