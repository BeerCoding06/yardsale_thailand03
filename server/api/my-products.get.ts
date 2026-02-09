// server/api/my-products.get.ts
// Fetch user's products via WordPress custom endpoint with JWT authentication

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    // Get JWT token from Authorization header
    const authHeader = getHeader(event, 'authorization') || getHeader(event, 'Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: "Authorization header with Bearer token is required",
      });
    }
    
    const token = authHeader.replace('Bearer ', '');

    // Get WordPress base URL from runtime config
    const config = useRuntimeConfig();
    const wpBaseUrl = config.public.wpBaseUrl || 'http://157.85.98.150:8080';

    // Build query params for WordPress custom endpoint
    const queryParams: Record<string, string | number> = {
      per_page: 100,
    };
    if (query.status) queryParams.status = String(query.status);
    if (query.per_page) queryParams.per_page = Number(query.per_page);
    if (query.page) queryParams.page = Number(query.page);

    const url = `${wpBaseUrl}/wp-json/yardsale/v1/my-products?${new URLSearchParams(queryParams as Record<string, string>).toString()}`;

    console.log('[my-products] Calling WordPress custom endpoint:', url);
    console.log('[my-products] With JWT token (first 20 chars):', token.substring(0, 20) + '...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[my-products] WordPress API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to fetch user products',
      });
    }

    const data = await response.json();
    console.log('[my-products] WordPress API response:', data);
    
    return data;
  } catch (error: any) {
    console.error('[my-products] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to fetch user products",
    });
  }
});
