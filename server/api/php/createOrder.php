<?php
/**
 * Create Order using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/createOrder.php
 * Body: Order data
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[createOrder] Request body length: ' . strlen($input));

$orderData = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[createOrder] JSON decode error: ' . json_last_error_msg());
    error_log('[createOrder] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$orderData) {
    error_log('[createOrder] Error: orderData is empty or invalid');
    sendErrorResponse('Invalid order data', 400);
}

// Build API URL
$url = buildWcApiUrl('wc/v3/orders', [], true); // Use Basic Auth

// Create order via WooCommerce API
$result = fetchWooCommerceApi($url, 'POST', $orderData, true); // Use Basic Auth

if (!$result['success']) {
    $errorMessage = 'Failed to create order';
    if (!empty($result['data']['message'])) {
        $errorMessage = $result['data']['message'];
    }
    sendErrorResponse($errorMessage, $result['http_code'] ?: 500);
}

// Return response
sendJsonResponse([
    'order' => $result['data']
]);

?>
