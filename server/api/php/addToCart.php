<?php
/**
 * Add Product to Cart using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/addToCart.php
 * Body: { productId: number }
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();

if (empty($input)) {
    error_log('[addToCart] Error: Empty request body');
    sendErrorResponse('Request body is required', 400);
}

error_log('[addToCart] Request body length: ' . strlen($input));
error_log('[addToCart] Request body (first 200 chars): ' . substr($input, 0, 200));

$body = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[addToCart] JSON decode error: ' . json_last_error_msg());
    error_log('[addToCart] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!is_array($body)) {
    error_log('[addToCart] Error: Request body is not an array/object');
    sendErrorResponse('Invalid request body format', 400);
}

$productId = isset($body['productId']) ? (int)$body['productId'] : null;

error_log('[addToCart] Parsed productId: ' . ($productId ?? 'null'));

if (!$productId) {
    error_log('[addToCart] Error: productId is required');
    sendErrorResponse('productId is required', 400);
}

// Fetch product from WooCommerce API
$url = buildWcApiUrl("wc/v3/products/$productId", [], true); // Use Basic Auth
$logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
error_log('[addToCart] Fetching product: ' . $logUrl);

$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    $errorMsg = 'Product not found';
    if (!empty($result['raw_response'])) {
        $errorMsg = 'API Error: ' . substr($result['raw_response'], 0, 200);
    }
    error_log('[addToCart] Failed to fetch product ' . $productId . ': ' . $errorMsg . ' (HTTP: ' . ($result['http_code'] ?? 'N/A') . ')');
    sendErrorResponse($errorMsg, $result['http_code'] ?: 404);
}

$product = $result['data'];

if (empty($product)) {
    error_log('[addToCart] Product data is empty for ID: ' . $productId);
    sendErrorResponse('Product not found', 404);
}

error_log('[addToCart] Successfully fetched product ' . $productId);

// Get image from WooCommerce API
$imageUrl = null;
if (!empty($product['images']) && is_array($product['images']) && count($product['images']) > 0) {
    $imageUrl = $product['images'][0]['src'] ?? null;
}

// Format prices from WooCommerce API
$regularPrice = '';
$salePrice = null;

$regularPriceValue = null;
if (!empty($product['regular_price']) && $product['regular_price'] !== '') {
    $regularPriceValue = $product['regular_price'];
} elseif (!empty($product['price']) && $product['price'] !== '') {
    $regularPriceValue = $product['price'];
}

if ($regularPriceValue !== null && $regularPriceValue !== '') {
    $price = (float)$regularPriceValue;
    if ($price > 0) {
        $regularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
    }
}

$salePriceValue = null;
if (!empty($product['sale_price']) && $product['sale_price'] !== '') {
    $salePriceValue = $product['sale_price'];
}

if ($salePriceValue !== null && $salePriceValue !== '') {
    $price = (float)$salePriceValue;
    if ($price > 0) {
        $regularPriceNum = $regularPriceValue ? (float)$regularPriceValue : 0;
        if ($price < $regularPriceNum || $regularPriceNum === 0) {
            $salePrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
        }
    }
}

// Get SKU and stock from WooCommerce API
$productSku = $product['sku'] ?? $product['slug'] ?? 'product-' . $product['id'];

$stockQuantity = null;
$stockStatus = 'IN_STOCK';
if (isset($product['stock_quantity']) && $product['stock_quantity'] !== null) {
    $stockQuantity = (int)$product['stock_quantity'];
}
if (isset($product['stock_status'])) {
    $stockStatus = strtoupper($product['stock_status']);
}

// Create cart item key
$key = 'simple-' . $productId;

// Return response
sendJsonResponse([
    'addToCart' => [
        'cartItem' => [
            'key' => $key,
            'product' => [
                'node' => [
                    'id' => $product['id'],
                    'databaseId' => $product['id'],
                    'name' => $product['name'] ?? '',
                    'slug' => $product['slug'],
                    'sku' => $productSku,
                    'regularPrice' => $regularPrice,
                    'salePrice' => $salePrice,
                    'stockQuantity' => $stockQuantity,
                    'stockStatus' => $stockStatus,
                    'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null
                ]
            ],
            'quantity' => 1
        ]
    ]
]);

?>
