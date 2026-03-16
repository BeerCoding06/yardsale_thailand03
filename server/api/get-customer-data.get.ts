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
      console.warn('[get-customer-data] WordPress API error:', response.status, errorText);
      // เมื่อ 401 (รหัสผ่าน/สิทธิ์) ไม่ throw – คืน success + billing ว่าง เพื่อให้ฟอร์มยังใช้ข้อมูลจาก login ได้
      if (response.status === 401) {
        return { success: true, customer: null, billing: {} };
      }
      throw createError({
        statusCode: response.status,
        message: errorText || 'Failed to fetch customer data',
      });
    }
    
    let userData = await response.json();
    
    if (Array.isArray(userData) && userData.length > 0) {
      userData = userData[0];
    }
    if (!userData || typeof userData !== 'object') {
      throw createError({ statusCode: 502, message: 'Invalid user data from WordPress' });
    }
    
    const { password, ...safeUserData } = userData;
    const meta = userData?.meta ?? {};
    
    // Build billing for checkout form (รองรับทั้ง WP user และ meta เช่น first_name, billing_address_1)
    const first = userData?.first_name ?? meta?.first_name ?? '';
    const last = userData?.last_name ?? meta?.last_name ?? '';
    const nameParts = (userData?.name || '').trim().split(/\s+/);
    const billing = {
      first_name: first || nameParts[0] || '',
      last_name: last || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''),
      email: userData?.email ?? userData?.user_email ?? '',
      phone: userData?.phone ?? meta?.billing_phone ?? meta?.phone ?? '',
      address_1: meta?.billing_address_1 ?? meta?.billing_address ?? '',
      address_2: meta?.billing_address_2 ?? '',
      city: meta?.billing_city ?? '',
      state: meta?.billing_state ?? '',
      postcode: meta?.billing_postcode ?? '',
      country: meta?.billing_country ?? 'TH',
    };
    
    return {
      success: true,
      customer: safeUserData,
      billing,
    };
  } catch (error: any) {
    console.error('[get-customer-data] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to fetch customer data',
    });
  }
});
