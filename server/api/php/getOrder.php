<?php
/**
 * Get Order(s) from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getOrder.php
 * Query params: order_id (for single order) OR customer (for customer orders)
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get query parameters
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;
$customerId = isset($_GET['customer']) ? (int)$_GET['customer'] : null;

// If order_id is provided, fetch single order
if ($orderId) {
    // Build API URL for single order
    $url = buildWcApiUrl("wc/v3/orders/$orderId", [], true); // Use Basic Auth
    
    // Fetch from WooCommerce API
    error_log("[getOrder] Fetching single order ID: $orderId");
    $result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth
    
    if (!$result['success']) {
        error_log("[getOrder] Failed to fetch order $orderId: " . ($result['error'] ?? 'Unknown error'));
        sendErrorResponse('Order not found', 404);
    }
    
    $order = $result['data'];
    
    // Return response
    sendJsonResponse([
        'order' => $order
    ]);
}
// If customer is provided, fetch all orders for that customer
elseif ($customerId) {
    // Build API URL for customer orders
    $params = [
        'customer' => $customerId,
        'per_page' => 100
    ];
    
    $url = buildWcApiUrl('wc/v3/orders', $params, true); // Use Basic Auth
    
    // Fetch from WooCommerce API
    error_log("[getOrder] Fetching orders for customer ID: $customerId");
    $result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth
    
    if (!$result['success']) {
        error_log("[getOrder] Failed to fetch orders for customer $customerId: " . ($result['error'] ?? 'Unknown error'));
        sendErrorResponse('Failed to fetch orders', $result['http_code'] ?: 500);
    }
    
    $orders = $result['data'] ?? [];
    
    if (!is_array($orders)) {
        $orders = [];
    }
    
    error_log("[getOrder] Fetched " . count($orders) . " orders for customer $customerId");
    
    // Return response
    sendJsonResponse([
        'orders' => $orders,
        'count' => count($orders)
    ]);
}
else {
    sendErrorResponse('order_id or customer parameter is required', 400);
}

?>
