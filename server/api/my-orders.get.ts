// server/api/my-orders.get.ts
// ดึงเฉพาะออเดอร์ของ user ที่ login (ใช้ JWT เท่านั้น – ไม่รับ customer_id จาก query)

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
    // ไม่ใส่ customer_id ใน queryParams – WordPress จะใช้ user จาก JWT เท่านั้น

    // getMyOrders.php เรียก WordPress yardsale/v1/my-orders โดยส่งแค่ JWT; WP กรองด้วย customer_id = current user
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
