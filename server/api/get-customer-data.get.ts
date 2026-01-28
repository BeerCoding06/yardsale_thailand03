// server/api/get-customer-data.get.ts
// Fetch customer data from WordPress REST API

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    
    const customerId = query.customer_id;
    const customerEmail = query.customer_email;
    
    if (!customerId && !customerEmail) {
      throw createError({
        statusCode: 400,
        message: "customer_id or customer_email is required",
      });
    }
    
    // Use WordPress REST API to fetch user data
    const headers = wpUtils.getWpApiHeaders(true, false);
    
    if (!headers['Authorization']) {
      throw createError({
        statusCode: 500,
        message: "WordPress API credentials not configured",
      });
    }
    
    let apiUrl: string;
    if (customerId) {
      apiUrl = wpUtils.buildWpApiUrl(`wp/v2/users/${customerId}`);
    } else {
      // Search by email
      apiUrl = wpUtils.buildWpApiUrl('wp/v2/users', {
        search: customerEmail,
        per_page: 1
      });
    }
    
    console.log('[get-customer-data] Fetching from WordPress API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[get-customer-data] WordPress API error:', response.status, errorText);
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to fetch customer data',
      });
    }
    
    let userData = await response.json();
    
    // If searching by email, get first result
    if (Array.isArray(userData) && userData.length > 0) {
      userData = userData[0];
    }
    
    // Filter sensitive data
    const { password, ...safeUserData } = userData;
    
    return {
      customer: safeUserData
    };
  } catch (error: any) {
    console.error('[get-customer-data] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch customer data',
    });
  }
});
