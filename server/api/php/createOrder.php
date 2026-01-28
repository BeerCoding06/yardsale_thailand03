<?php
/**
 * Create Order using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/createOrder.php
 * Body: Order data
 */

require_once __DIR__ . '/config.php';

// Get request body
$input = file_get_contents('php://input');
$orderData = json_decode($input, true);

if (!$orderData) {
    sendErrorResponse('Invalid order data', 400);
}

// Build API URL
$url = buildWcApiUrl('wc/v3/orders');

// Create order via WooCommerce API
$result = fetchWooCommerceApi($url, 'POST', $orderData);

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
