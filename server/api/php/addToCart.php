<?php
/**
 * Add Product to Cart using WooCommerce REST API
 * 
 * Endpoint: POST /server/api/php/addToCart.php
 * Body: { productId: number }
 */

require_once __DIR__ . '/config.php';

// Get request body
$input = file_get_contents('php://input');
$body = json_decode($input, true);

$productId = isset($body['productId']) ? (int)$body['productId'] : null;

if (!$productId) {
    sendErrorResponse('productId is required', 400);
}

// Fetch product from WooCommerce API
$url = buildWcApiUrl("wc/v3/products/$productId");
$result = fetchWooCommerceApi($url, 'GET', null, false);

if (!$result['success']) {
    sendErrorResponse('Product not found', 404);
}

$product = $result['data'];

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
