// server/api/my-orders.get.ts
// Fetch orders for the logged-in user only (JWT required; never use client-supplied customer_id)

import { executePhpScript } from '../utils/php-executor';

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization') || getHeader(event, 'Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError({
        statusCode: 401,
        message: 'Authorization header with Bearer token is required',
      });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      throw createError({
        statusCode: 401,
        message: 'JWT token is required',
      });
    }

    const query = getQuery(event);
    const queryParams: Record<string, string | number> = {
      per_page: query.per_page ? Number(query.per_page) : 100,
    };
    if (query.page) queryParams.page = Number(query.page);
    if (query.status) queryParams.status = String(query.status);

    // Use getMyOrders.php so WordPress filters by JWT user only (ignore any customer_id from query)
    const data = await executePhpScript({
      script: 'getMyOrders.php',
      queryParams,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error: any) {
    console.error('[my-orders] Error:', error.message || error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch orders',
    });
  }
});
