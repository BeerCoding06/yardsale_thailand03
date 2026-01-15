// server/api/categories.get.ts
// Use PHP API instead of GraphQL

export default cachedEventHandler(
  async (event) => {
    try {
      const config = useRuntimeConfig();
      // Use internal port 80 for container communication
      // Nuxt server should call Nginx on port 80 (internal)
      const baseUrl = 'http://localhost:80';
      
      // Get query parameters
      const query = getQuery(event);
      const parent = query.parent || '0';
      const hide_empty = query.hide_empty !== 'false';
      const orderby = query.orderby || 'name';
      const order = query.order || 'ASC';
      
      // Build PHP API URL
      const phpApiUrl = `${baseUrl}/server/api/php/getCategories.php?parent=${parent}&hide_empty=${hide_empty}&orderby=${orderby}&order=${order}`;
      
      // Call PHP API
      const response = await $fetch(phpApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return response;
    } catch (error: any) {
      console.error('[categories] Error:', error);
      throw createError({
        statusCode: error?.statusCode || 500,
        message: error?.message || 'Failed to fetch categories from PHP API',
      });
    }
  },
  {
    maxAge: 1, // Cache for 1 second (real-time)
    swr: false, // Disable SWR for immediate updates
  }
);
