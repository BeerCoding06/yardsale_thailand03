<?php
/**
 * Get User's Products from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getMyProducts.php
 * Query params: user_id
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get query parameters
$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;

if (!$userId) {
    sendErrorResponse('user_id is required', 400);
}

error_log('[getMyProducts] Fetching products for user ID: ' . $userId);

// First, fetch product IDs from WordPress REST API (supports author filtering)
$baseUrl = rtrim(WC_BASE_URL, '/');
$wpUrl = $baseUrl . '/wp-json/wp/v2/product?author=' . $userId . '&per_page=100&status=any&fields=id';

error_log('[getMyProducts] Fetching product IDs from WordPress API: ' . $wpUrl);

$wpResult = fetchWordPressApi($wpUrl, 'GET');

if (!$wpResult['success']) {
    error_log('[getMyProducts] WordPress API error: ' . ($wpResult['error'] ?? 'Unknown error'));
    sendErrorResponse('Failed to fetch product IDs: ' . ($wpResult['error'] ?? 'Unknown error'), $wpResult['http_code'] ?: 500);
}

$wpProducts = $wpResult['data'] ?? [];
$productIds = [];

if (is_array($wpProducts)) {
    foreach ($wpProducts as $product) {
        if (!empty($product['id'])) {
            $productIds[] = $product['id'];
        }
    }
}

error_log('[getMyProducts] Found ' . count($productIds) . ' product IDs');

if (empty($productIds)) {
    sendJsonResponse([
        'success' => true,
        'products' => [],
        'count' => 0
    ]);
}

// Fetch products from WooCommerce API using product IDs
$params = [
    'include' => implode(',', $productIds),
    'per_page' => 100,
    'status' => 'any'
];

$url = buildWcApiUrl('wc/v3/products', $params, true); // Use Basic Auth

error_log('[getMyProducts] Fetching products from WooCommerce API: ' . $url);

$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    error_log('[getMyProducts] WooCommerce API error: ' . ($result['error'] ?? 'Unknown error'));
    sendErrorResponse('Failed to fetch products: ' . ($result['error'] ?? 'Unknown error'), $result['http_code'] ?: 500);
}

$products = $result['data'] ?? [];

if (!is_array($products)) {
    $products = [];
}

error_log('[getMyProducts] Successfully fetched ' . count($products) . ' products');

// Return response
sendJsonResponse([
    'success' => true,
    'products' => $products,
    'count' => count($products)
]);

?>
