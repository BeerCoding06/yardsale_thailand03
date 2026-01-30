<?php
/**
 * Cancel Order using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/cancelOrder.php
 * Body: { order_id, customer_id }
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[cancelOrder] Request body length: ' . strlen($input));

$orderData = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[cancelOrder] JSON decode error: ' . json_last_error_msg());
    error_log('[cancelOrder] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$orderData) {
    error_log('[cancelOrder] Error: orderData is empty or invalid');
    sendErrorResponse('Invalid order data', 400);
}

$orderId = isset($orderData['order_id']) ? (int)$orderData['order_id'] : null;
$customerId = isset($orderData['customer_id']) ? (int)$orderData['customer_id'] : null;

if (!$orderId) {
    sendErrorResponse('order_id is required', 400);
}

error_log('[cancelOrder] Cancelling order ID: ' . $orderId);

// First, verify the order exists
$getUrl = buildWcApiUrl('wc/v3/orders/' . $orderId, [], true); // Use Basic Auth

error_log('[cancelOrder] Fetching order from WooCommerce API: ' . $getUrl);

$getResult = fetchWooCommerceApi($getUrl, 'GET', null, true); // Use Basic Auth

if (!$getResult['success']) {
    error_log('[cancelOrder] Order not found: ' . ($getResult['error'] ?? 'Unknown error'));
    sendErrorResponse('Order not found', $getResult['http_code'] ?: 404);
}

$existingOrder = $getResult['data'] ?? [];

// Verify ownership if customerId is provided
if ($customerId && !empty($existingOrder['customer_id']) && (int)$existingOrder['customer_id'] !== $customerId) {
    error_log('[cancelOrder] Permission denied: customer ' . $customerId . ' does not own order ' . $orderId);
    sendErrorResponse('You don\'t have permission to cancel this order', 403);
}

// Update order status to cancelled
$url = buildWcApiUrl('wc/v3/orders/' . $orderId, [], true); // Use Basic Auth

error_log('[cancelOrder] Cancelling order via WooCommerce API: ' . $url);

$result = fetchWooCommerceApi($url, 'PUT', ['status' => 'cancelled'], true); // Use Basic Auth

if (!$result['success']) {
    $errorMessage = 'Failed to cancel order';
    if (!empty($result['data']['message'])) {
        $errorMessage = $result['data']['message'];
    } elseif (!empty($result['error'])) {
        $errorMessage = $result['error'];
    }
    error_log('[cancelOrder] Error: ' . $errorMessage);
    sendErrorResponse($errorMessage, $result['http_code'] ?: 500);
}

error_log('[cancelOrder] Successfully cancelled order ID: ' . $orderId);

// Return response
sendJsonResponse([
    'success' => true,
    'order' => $result['data']
]);

?>
