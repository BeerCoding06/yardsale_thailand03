<?php
/**
 * Get Orders from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getOrders.php
 * Query params: customer_id, customer_email, status, per_page, page
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get query parameters
$customerId = isset($_GET['customer_id']) ? $_GET['customer_id'] : null;
$customerEmail = isset($_GET['customer_email']) ? $_GET['customer_email'] : null;
$status = isset($_GET['status']) ? $_GET['status'] : null;
$per_page = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 100;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;

// Build API parameters
$params = [
    'per_page' => $per_page,
    'page' => $page
];

if ($customerId) {
    $params['customer'] = $customerId;
}

if ($customerEmail) {
    $params['customer_email'] = $customerEmail;
}

if ($status) {
    $params['status'] = $status;
}

// Build API URL
$url = buildWcApiUrl('wc/v3/orders', $params, true); // Use Basic Auth

// Fetch from WooCommerce API
$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    sendErrorResponse($result['error'] ?? 'Failed to fetch orders', $result['http_code'] ?: 500);
}

$orders = $result['data'] ?? [];

if (!is_array($orders)) {
    $orders = [];
}

// Return response
sendJsonResponse([
    'orders' => $orders,
    'count' => count($orders)
]);

?>
