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

// Build WordPress REST API v2 URL
$url = buildWpApiUrl('wp/v2/product', $params);

// Fetch from WordPress REST API v2 (with Basic Auth)
$result = fetchWordPressApi($url, 'GET');

if (!$result['success']) {
    sendJsonResponse([
        'products' => [
            'nodes' => []
        ]
    ]);
}

$products = $result['data'] ?? [];

// Format products
$formattedProducts = [];
foreach ($products as $product) {
    // Get featured image from _embedded
    $imageUrl = null;
    if (!empty($product['_embedded']['wp:featuredmedia'][0]['source_url'])) {
        $imageUrl = $product['_embedded']['wp:featuredmedia'][0]['source_url'];
    }
    
    // Get price from meta fields
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
    
    // Get SKU from meta
    $sku = $product['slug'] ?? 'product-' . $product['id'];
    if (!empty($product['meta']) && isset($product['meta']['_sku'])) {
        $sku = $product['meta']['_sku'];
    }
    
    $formattedProducts[] = [
        'id' => $product['id'],
        'databaseId' => $product['id'],
        'sku' => $sku,
        'slug' => $product['slug'],
        'name' => $product['title']['rendered'] ?? $product['title'] ?? '',
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
