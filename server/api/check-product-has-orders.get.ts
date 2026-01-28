// server/api/check-product-has-orders.get.ts
// Check if a product has been purchased (has orders) using WooCommerce REST API

import * as wpUtils from '~/server/utils/wp';

export default defineCachedEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const productId = query.product_id;
    
    if (!productId) {
      // Return false instead of throwing error to not block the UI
      console.warn('[check-product-has-orders] product_id is required');
      return { has_orders: false };
    }
    
    // Use WooCommerce REST API to check if product has orders
    
    try {
      const wcHeaders = wpUtils.getWpApiHeaders(false, true);
      
      if (!wcHeaders['Authorization']) {
        // If WooCommerce API not configured, return false (no orders)
        console.warn('[check-product-has-orders] WooCommerce API not configured, assuming no orders');
        return { has_orders: false };
      }
      
      // Search for orders containing this product
      const apiUrl = wpUtils.buildWpApiUrl('wc/v3/orders', {
        product: productId,
        per_page: 1,
        status: 'completed,processing,on-hold'
      });
      
      console.log('[check-product-has-orders] Checking orders for product:', productId);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: wcHeaders,
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        // If API error, assume no orders (don't block the UI)
        console.warn('[check-product-has-orders] WooCommerce API error:', response.status);
        return { has_orders: false };
      }
      
      const orders = await response.json();
      const hasOrders = Array.isArray(orders) && orders.length > 0;
      
      console.log('[check-product-has-orders] Product has orders:', hasOrders);
      
      return {
        has_orders: hasOrders
      };
    } catch (fetchError: any) {
      console.warn('[check-product-has-orders] Fetch error:', fetchError);
      return { has_orders: false };
    }
  } catch (error: any) {
    console.error('[check-product-has-orders] Error:', error);
    
    // Return false on error to not block the UI
    return { has_orders: false };
  }
}, {
  maxAge: 60, // Cache for 60 seconds
});
