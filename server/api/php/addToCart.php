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
$result = fetchWooCommerceApi($url, 'GET');

if (!$result['success']) {
    sendErrorResponse('Product not found', 404);
}

$product = $result['data'];

// Format prices
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

// Get image
$imageUrl = null;
if (!empty($product['images']) && is_array($product['images']) && count($product['images']) > 0) {
    $imageUrl = $product['images'][0]['src'] ?? null;
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
                    'name' => $product['name'],
                    'slug' => $product['slug'],
                    'sku' => $product['sku'] ?? $product['slug'] ?? 'product-' . $product['id'],
                    'regularPrice' => $regularPrice,
                    'salePrice' => $salePrice,
                    'stockQuantity' => isset($product['stock_quantity']) && $product['stock_quantity'] !== null ? (int)$product['stock_quantity'] : null,
                    'stockStatus' => strtoupper($product['stock_status'] ?? 'instock'),
                    'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null
                ]
            ],
            'quantity' => 1
        ]
    ]
]);

?>
