<?php
/**
 * Create Product using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/createProduct.php
 * Body: Product data
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[createProduct] Request body length: ' . strlen($input));

$productData = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[createProduct] JSON decode error: ' . json_last_error_msg());
    error_log('[createProduct] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$productData) {
    error_log('[createProduct] Error: productData is empty or invalid');
    sendErrorResponse('Invalid product data', 400);
}

error_log('[createProduct] Creating product: ' . ($productData['name'] ?? 'N/A'));

// Format product data for WooCommerce REST API
$wcProductData = [
    'name' => $productData['name'] ?? '',
    'type' => $productData['type'] ?? 'simple',
    'regular_price' => $productData['regular_price'] ?? '0',
    'status' => $productData['status'] ?? 'pending', // New products start as pending for review
];

// Add categories if provided
if (!empty($productData['categories']) && is_array($productData['categories'])) {
    $wcProductData['categories'] = [];
    foreach ($productData['categories'] as $cat) {
        $wcProductData['categories'][] = [
            'id' => is_array($cat) ? ($cat['id'] ?? $cat) : $cat
        ];
    }
}

// Add images if provided
if (!empty($productData['images']) && is_array($productData['images'])) {
    $wcProductData['images'] = [];
    foreach ($productData['images'] as $img) {
        $wcProductData['images'][] = [
            'src' => is_array($img) ? ($img['src'] ?? $img['url'] ?? $img) : $img
        ];
    }
}

// Add description if provided
if (!empty($productData['description'])) {
    $wcProductData['description'] = $productData['description'];
}

// Add short_description if provided
if (!empty($productData['short_description'])) {
    $wcProductData['short_description'] = $productData['short_description'];
}

// Add SKU if provided
if (!empty($productData['sku'])) {
    $wcProductData['sku'] = $productData['sku'];
}

// Add stock management if provided
if (isset($productData['manage_stock'])) {
    $wcProductData['manage_stock'] = (bool)$productData['manage_stock'];
}
if (isset($productData['stock_quantity'])) {
    $wcProductData['stock_quantity'] = (int)$productData['stock_quantity'];
}

// Build API URL
$url = buildWcApiUrl('wc/v3/products', [], true); // Use Basic Auth

error_log('[createProduct] Creating product via WooCommerce API: ' . $url);

// Create product via WooCommerce API
$result = fetchWooCommerceApi($url, 'POST', $wcProductData, true); // Use Basic Auth

if (!$result['success']) {
    $errorMessage = 'Failed to create product';
    if (!empty($result['data']['message'])) {
        $errorMessage = $result['data']['message'];
    } elseif (!empty($result['error'])) {
        $errorMessage = $result['error'];
    }
    error_log('[createProduct] Error: ' . $errorMessage);
    sendErrorResponse($errorMessage, $result['http_code'] ?: 500);
}

error_log('[createProduct] Successfully created product ID: ' . ($result['data']['id'] ?? 'N/A'));

// Return response
sendJsonResponse([
    'success' => true,
    'product' => $result['data']
]);

?>
