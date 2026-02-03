// server/api/my-orders-jwt.get.ts
// Fetch user's orders via WordPress custom endpoint with JWT authentication

import { executePhpScript } from '../utils/php-executor';

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
    
    // Build query params for PHP script
    const queryParams: Record<string, string | number> = {
      per_page: 100,
    };
    if (query.status) queryParams.status = String(query.status);
    if (query.per_page) queryParams.per_page = Number(query.per_page);
    if (query.page) queryParams.page = Number(query.page);
    
    console.log('[my-orders-jwt] Executing PHP script: getMyOrders.php');
    
    // Execute PHP script with JWT token in environment
    // The PHP script will read the Authorization header from the request
    const data = await executePhpScript({
      script: 'getMyOrders.php',
      queryParams,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return data;
  } catch (error: any) {
    console.error('[my-orders-jwt] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch orders',
    });
  }
});
