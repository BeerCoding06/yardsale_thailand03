<?php
/**
 * Get Single Order from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getOrder.php
 * Query params: order_id
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get query parameters
$orderId = isset($_GET['order_id']) ? (int)$_GET['order_id'] : null;

if (!$orderId) {
    sendErrorResponse('order_id is required', 400);
}

// Build API URL
$url = buildWcApiUrl("wc/v3/orders/$orderId", [], true); // Use Basic Auth

// Fetch from WooCommerce API
$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    sendErrorResponse('Order not found', 404);
}

$order = $result['data'];

// Return response
sendJsonResponse([
    'order' => $order
]);

?>
