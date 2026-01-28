<?php
/**
 * Get Products from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getProducts.php
 * Query params: page, per_page, search, category, order, orderby
 */

require_once __DIR__ . '/config.php';

// Get query parameters
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$per_page = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 21;
$search = isset($_GET['search']) ? $_GET['search'] : null;
$category = isset($_GET['category']) ? $_GET['category'] : null;
$order = isset($_GET['order']) ? $_GET['order'] : 'desc';
$orderby = isset($_GET['orderby']) ? $_GET['orderby'] : 'date';
$after = isset($_GET['after']) ? $_GET['after'] : null;

// Map orderby to WooCommerce format
$orderbyMap = [
    'date' => 'date',
    'title' => 'title',
    'price' => 'price',
    'rating' => 'rating',
    'popularity' => 'popularity'
];
$wcOrderby = isset($orderbyMap[$orderby]) ? $orderbyMap[$orderby] : 'date';

// Build API parameters
$params = [
    'per_page' => $per_page,
    'page' => $page,
    'order' => $order,
    'orderby' => $wcOrderby,
    'status' => 'publish'
];

if ($search) {
    $params['search'] = $search;
}

if ($category) {
    $params['category'] = $category;
}

// Build API URL
$url = buildWcApiUrl('wc/v3/products', $params);

// Fetch from WooCommerce API
$result = fetchWooCommerceApi($url, 'GET');

if (!$result['success']) {
    sendErrorResponse($result['error'] ?? 'Failed to fetch products', $result['http_code'] ?: 500);
}

$products = $result['data'] ?? [];

// Format products to match expected structure
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
    
    // Get gallery images
    $galleryImages = [];
    if (!empty($product['images']) && is_array($product['images'])) {
        foreach ($product['images'] as $img) {
            if (!empty($img['src'])) {
                $galleryImages[] = ['sourceUrl' => $img['src']];
            }
        }
    }
    
    $formattedProducts[] = [
        'id' => $product['id'],
        'databaseId' => $product['id'],
        'sku' => $product['sku'] ?? $product['slug'] ?? 'product-' . $product['id'],
        'slug' => $product['slug'],
        'name' => $product['name'] ?? '',
        'description' => $product['description'] ?? '',
        'regularPrice' => $regularPrice,
        'salePrice' => $salePrice,
        'stockQuantity' => isset($product['stock_quantity']) && $product['stock_quantity'] !== null ? (int)$product['stock_quantity'] : null,
        'stockStatus' => strtoupper($product['stock_status'] ?? 'instock'),
        'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null,
        'galleryImages' => ['nodes' => $galleryImages],
        'allPaStyle' => ['nodes' => []],
        'link' => $product['permalink'] ?? '',
        'status' => $product['status'] ?? 'publish'
    ];
}

// Calculate pagination
$hasNextPage = count($products) >= $per_page;
$endCursor = $hasNextPage ? base64_encode('page:' . ($page + 1)) : null;

// Return response
sendJsonResponse([
    'products' => [
        'nodes' => $formattedProducts,
        'pageInfo' => [
            'hasNextPage' => $hasNextPage,
            'endCursor' => $endCursor
        ]
    ]
]);

?>
