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

// Build WooCommerce API parameters
$params = [
    'search' => $search,
    'per_page' => $limit,
    'status' => 'publish'
];

// Build WooCommerce API URL
$url = buildWcApiUrl('wc/v3/products', $params);
$logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
error_log('[searchProducts] Searching: ' . $logUrl);

// Fetch from WooCommerce API
$result = fetchWooCommerceApi($url, 'GET', null, false);

if (!$result['success']) {
    error_log('[searchProducts] API error: ' . ($result['error'] ?? 'Unknown') . ' (HTTP: ' . ($result['http_code'] ?? 'N/A') . ')');
    // Return empty results instead of error
    sendJsonResponse([
        'products' => [
            'nodes' => []
        ]
    ]);
}

$products = $result['data'] ?? [];

// Validate response
if (!is_array($products)) {
    error_log('[searchProducts] Invalid response format. Expected array, got: ' . gettype($products));
    $products = [];
}

error_log('[searchProducts] Found ' . count($products) . ' products');

// Format products from WooCommerce API
$formattedProducts = [];
foreach ($products as $product) {
    // Validate product structure
    if (!is_array($product) || empty($product['id'])) {
        continue;
    }
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
