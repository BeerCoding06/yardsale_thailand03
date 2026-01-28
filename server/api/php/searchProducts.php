<?php
/**
 * Search Products from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/searchProducts.php
 * Query params: search, limit
 */

require_once __DIR__ . '/config.php';

// Get query parameters
$search = isset($_GET['search']) ? $_GET['search'] : '';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 6;

if (empty($search)) {
    sendJsonResponse([
        'products' => [
            'nodes' => []
        ]
    ]);
}

// Build WordPress REST API v2 parameters
$params = [
    'search' => $search,
    'per_page' => $limit,
    'status' => 'publish',
    '_embed' => '1'
];

// Build WooCommerce API URL
$url = buildWcApiUrl('wc/v3/products', $params);

// Fetch from WooCommerce API
$result = fetchWooCommerceApi($url, 'GET', null, false);

if (!$result['success']) {
    sendJsonResponse([
        'products' => [
            'nodes' => []
        ]
    ]);
}

$products = $result['data'] ?? [];

// Format products from WooCommerce API
$formattedProducts = [];
foreach ($products as $product) {
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
    
    $formattedProducts[] = [
        'id' => $product['id'],
        'databaseId' => $product['id'],
        'sku' => $product['sku'] ?? $product['slug'] ?? 'product-' . $product['id'],
        'slug' => $product['slug'],
        'name' => $product['name'] ?? '',
        'regularPrice' => $regularPrice,
        'salePrice' => $salePrice,
        'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null
    ];
}

// Return response
sendJsonResponse([
    'products' => [
        'nodes' => $formattedProducts
    ]
]);

?>
