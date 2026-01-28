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

// Fetch product from WordPress REST API v2
$url = buildWpApiUrl("wp/v2/product/$productId", ['_embed' => '1']);
$result = fetchWordPressApi($url, 'GET');

if (!$result['success']) {
    sendErrorResponse('Product not found', 404);
}

$product = $result['data'];

// Get featured image from _embedded
$imageUrl = null;
if (!empty($product['_embedded']['wp:featuredmedia'][0]['source_url'])) {
    $imageUrl = $product['_embedded']['wp:featuredmedia'][0]['source_url'];
}

// Format prices from meta fields
$regularPrice = '';
$salePrice = null;

$regularPriceValue = null;
if (!empty($product['meta'])) {
    if (isset($product['meta']['_regular_price'])) {
        $regularPriceValue = $product['meta']['_regular_price'];
    } elseif (isset($product['meta']['_price'])) {
        $regularPriceValue = $product['meta']['_price'];
    }
}

if ($regularPriceValue !== null && $regularPriceValue !== '') {
    $price = (float)$regularPriceValue;
    if ($price > 0) {
        $regularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
    }
}

$salePriceValue = null;
if (!empty($product['meta']) && isset($product['meta']['_sale_price']) && $product['meta']['_sale_price'] !== '') {
    $salePriceValue = $product['meta']['_sale_price'];
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

// Get SKU and stock from meta
$productSku = $product['slug'] ?? 'product-' . $product['id'];
if (!empty($product['meta']) && isset($product['meta']['_sku'])) {
    $productSku = $product['meta']['_sku'];
}

$stockQuantity = null;
$stockStatus = 'IN_STOCK';
if (!empty($product['meta'])) {
    if (isset($product['meta']['_stock'])) {
        $stockQuantity = (int)$product['meta']['_stock'];
    }
    if (isset($product['meta']['_stock_status'])) {
        $stockStatus = strtoupper($product['meta']['_stock_status']);
    }
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
                    'name' => $product['title']['rendered'] ?? $product['title'] ?? '',
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
