<?php
/**
 * Create Order using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/createOrder.php
 * Body: Order data (billing can be camelCase; we map to WooCommerce snake_case)
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

// Map billing from camelCase (frontend) to WooCommerce snake_case
$billingIn = isset($orderData['billing']) && is_array($orderData['billing']) ? $orderData['billing'] : array();
$orderData['billing'] = array(
    'first_name' => $billingIn['first_name'] ?? $billingIn['firstName'] ?? '',
    'last_name'  => $billingIn['last_name'] ?? $billingIn['lastName'] ?? '',
    'address_1'  => $billingIn['address_1'] ?? $billingIn['address1'] ?? '',
    'address_2'  => $billingIn['address_2'] ?? $billingIn['address2'] ?? '',
    'city'       => $billingIn['city'] ?? '',
    'state'      => $billingIn['state'] ?? '',
    'postcode'   => $billingIn['postcode'] ?? '',
    'country'    => $billingIn['country'] ?? 'TH',
    'email'      => $billingIn['email'] ?? '',
    'phone'      => $billingIn['phone'] ?? '',
);

// Ensure line_items have product_id (int), quantity (int), price (string) for WooCommerce
if (!empty($orderData['line_items']) && is_array($orderData['line_items'])) {
    foreach ($orderData['line_items'] as $idx => $item) {
        $orderData['line_items'][$idx]['product_id'] = (int) ($item['product_id'] ?? 0);
        $orderData['line_items'][$idx]['quantity'] = (int) ($item['quantity'] ?? 1);
        $orderData['line_items'][$idx]['price'] = (string) ($item['price'] ?? '0');
        if (isset($item['variation_id']) && (int) $item['variation_id'] > 0) {
            $orderData['line_items'][$idx]['variation_id'] = (int) $item['variation_id'];
        }
    }
    $orderData['line_items'] = array_values(array_filter($orderData['line_items'], function ($item) {
        return isset($item['product_id']) && $item['product_id'] > 0;
    }));
}

if (empty($orderData['line_items'])) {
    error_log('[createOrder] Error: no valid line_items (product_id > 0)');
    sendErrorResponse('No valid items in order. Each item must have a valid product_id.', 400);
}

error_log('[createOrder] Mapped order: customer_id=' . ($orderData['customer_id'] ?? '') . ', line_items=' . count($orderData['line_items']));

// Build API URL
$url = buildWcApiUrl('wc/v3/orders', [], true); // Use Basic Auth

// Create order via WooCommerce API
$result = fetchWooCommerceApi($url, 'POST', $orderData, true); // Use Basic Auth

if (!$result['success']) {
    $errorMessage = 'Failed to create order';
    $data = $result['data'];
    if (is_array($data)) {
        if (!empty($data['message'])) {
            $errorMessage = is_string($data['message']) ? $data['message'] : json_encode($data['message']);
        } elseif (!empty($data['code'])) {
            $errorMessage = ($data['code'] ?? '') . ': ' . ($data['message'] ?? $result['raw_response'] ?? '');
        }
    }
    error_log('[createOrder] WooCommerce API error: ' . $errorMessage . ' (HTTP ' . ($result['http_code'] ?? 0) . ')');
    sendErrorResponse($errorMessage, $result['http_code'] ?: 500);
}

// Return response
sendJsonResponse([
    'order' => $result['data']
]);

?>
