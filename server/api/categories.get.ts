// server/api/categories.get.ts
// Use PHP API instead of GraphQL

export default cachedEventHandler(
  async (event) => {
    try {
      const config = useRuntimeConfig();
      // Use internal port 80 for container communication
      // Nginx is on port 80 and handles PHP API routing
      // Nuxt.js and nginx are in the same container, so use 127.0.0.1:80
      const baseUrl = 'http://127.0.0.1:80';
      
      // Get query parameters
      const query = getQuery(event);
      const parent = query.parent || '0';
      const hide_empty = query.hide_empty !== 'false';
      const orderby = query.orderby || 'name';
      const order = query.order || 'ASC';
      
      // Build PHP API URL
      const phpApiUrl = `${baseUrl}/server/api/php/getCategories.php?parent=${parent}&hide_empty=${hide_empty}&orderby=${orderby}&order=${order}`;
      
      // Call PHP API with timeout and error handling
      console.log('[categories] Calling PHP API:', phpApiUrl);
      
      try {
        const response = await $fetch(phpApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds timeout
        });
        
        console.log('[categories] PHP API response received');
        return response;
      } catch (fetchError: any) {
        console.error('[categories] Fetch error:', fetchError);
        console.error('[categories] Fetch error details:', {
          message: fetchError?.message,
          status: fetchError?.status,
          statusCode: fetchError?.statusCode,
          statusText: fetchError?.statusText,
          cause: fetchError?.cause,
          code: fetchError?.code,
        });
        throw fetchError;
      }
    } catch (error: any) {
      // Make sure all variables are defined in catch block scope
      const errorBaseUrl = 'http://127.0.0.1:80';
      const errorPhpApiUrl = `${errorBaseUrl}/server/api/php/getCategories.php`;
      
      console.error('[categories] Error:', error);
      console.error('[categories] PHP API URL:', errorPhpApiUrl);
      console.error('[categories] Error details:', {
        message: error?.message,
        statusCode: error?.statusCode,
        cause: error?.cause,
        code: error?.code,
      });
      throw createError({
        statusCode: error?.statusCode || 500,
        message: error?.message || 'Failed to fetch categories from PHP API',
        data: {
          phpApiUrl: errorPhpApiUrl,
          baseUrl: errorBaseUrl,
          error: error?.message,
        },
      });
    }
  },
  {
    maxAge: 1, // Cache for 1 second (real-time)
    swr: false, // Disable SWR for immediate updates
  }
);
