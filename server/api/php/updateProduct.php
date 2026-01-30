<?php
/**
 * Update Product using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/updateProduct.php
 * Body: Product data with product_id
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[updateProduct] Request body length: ' . strlen($input));

$productData = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[updateProduct] JSON decode error: ' . json_last_error_msg());
    error_log('[updateProduct] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$productData) {
    error_log('[updateProduct] Error: productData is empty or invalid');
    sendErrorResponse('Invalid product data', 400);
}

$productId = isset($productData['product_id']) ? (int)$productData['product_id'] : null;
$userId = isset($productData['user_id']) ? (int)$productData['user_id'] : null;

if (!$productId) {
    sendErrorResponse('product_id is required', 400);
}

error_log('[updateProduct] Updating product ID: ' . $productId);

// First, verify the product exists
$getUrl = buildWcApiUrl('wc/v3/products/' . $productId, [], true); // Use Basic Auth

error_log('[updateProduct] Fetching product from WooCommerce API: ' . $getUrl);

$getResult = fetchWooCommerceApi($getUrl, 'GET', null, true); // Use Basic Auth

if (!$getResult['success']) {
    error_log('[updateProduct] Product not found: ' . ($getResult['error'] ?? 'Unknown error'));
    sendErrorResponse('Product not found', $getResult['http_code'] ?: 404);
}

$existingProduct = $getResult['data'] ?? [];

// Verify ownership if userId is provided
if ($userId && !empty($existingProduct['post_author']) && (int)$existingProduct['post_author'] !== $userId) {
    error_log('[updateProduct] Permission denied: user ' . $userId . ' does not own product ' . $productId);
    sendErrorResponse('You don\'t have permission to update this product', 403);
}

// Format update data for WooCommerce REST API
$updateData = [
    'status' => 'pending', // Set to pending after update for review
];

if (!empty($productData['name'])) {
    $updateData['name'] = $productData['name'];
}
if (!empty($productData['description'])) {
    $updateData['description'] = $productData['description'];
}
if (!empty($productData['short_description'])) {
    $updateData['short_description'] = $productData['short_description'];
}
if (!empty($productData['regular_price'])) {
    $updateData['regular_price'] = $productData['regular_price'];
}
if (isset($productData['sale_price'])) {
    $updateData['sale_price'] = $productData['sale_price'];
}
if (!empty($productData['sku'])) {
    $updateData['sku'] = $productData['sku'];
}

// Update categories if provided
if (!empty($productData['categories']) && is_array($productData['categories'])) {
    $updateData['categories'] = [];
    foreach ($productData['categories'] as $cat) {
        $updateData['categories'][] = [
            'id' => is_array($cat) ? ($cat['id'] ?? $cat) : $cat
        ];
    }
}

// Update images if provided
if (!empty($productData['images']) && is_array($productData['images'])) {
    $updateData['images'] = [];
    foreach ($productData['images'] as $img) {
        $updateData['images'][] = [
            'src' => is_array($img) ? ($img['src'] ?? $img['url'] ?? $img) : $img
        ];
    }
}

// Update stock management if provided
if (isset($productData['manage_stock'])) {
    $updateData['manage_stock'] = (bool)$productData['manage_stock'];
}
if (isset($productData['stock_quantity'])) {
    $updateData['stock_quantity'] = (int)$productData['stock_quantity'];
}
if (!empty($productData['stock_status'])) {
    $updateData['stock_status'] = $productData['stock_status'];
}

// Build API URL
$url = buildWcApiUrl('wc/v3/products/' . $productId, [], true); // Use Basic Auth

error_log('[updateProduct] Updating product via WooCommerce API: ' . $url);

// Update product via WooCommerce API
$result = fetchWooCommerceApi($url, 'PUT', $updateData, true); // Use Basic Auth

if (!$result['success']) {
    $errorMessage = 'Failed to update product';
    if (!empty($result['data']['message'])) {
        $errorMessage = $result['data']['message'];
    } elseif (!empty($result['error'])) {
        $errorMessage = $result['error'];
    }
    error_log('[updateProduct] Error: ' . $errorMessage);
    sendErrorResponse($errorMessage, $result['http_code'] ?: 500);
}

error_log('[updateProduct] Successfully updated product ID: ' . $productId);

// Return response
sendJsonResponse([
    'success' => true,
    'product' => $result['data']
]);

?>
