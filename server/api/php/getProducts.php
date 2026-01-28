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
    // Get featured image from _embedded
    $imageUrl = null;
    if (!empty($product['_embedded']['wp:featuredmedia'][0]['source_url'])) {
        $imageUrl = $product['_embedded']['wp:featuredmedia'][0]['source_url'];
    } elseif (!empty($product['featured_media'])) {
        // Try to fetch media if not embedded
        $mediaUrl = buildWpApiUrl("wp/v2/media/{$product['featured_media']}");
        $mediaResult = fetchWordPressApi($mediaUrl, 'GET');
        if ($mediaResult['success'] && !empty($mediaResult['data']['source_url'])) {
            $imageUrl = $mediaResult['data']['source_url'];
        }
    }
    
    // Get gallery images (from meta or embedded)
    $galleryImages = [];
    if ($imageUrl) {
        $galleryImages[] = ['sourceUrl' => $imageUrl];
    }
    
    // Get price from meta fields (WordPress REST API v2 doesn't have price fields)
    $regularPrice = '';
    $salePrice = null;
    
    // Try to get price from meta
    if (!empty($product['meta'])) {
        $regularPriceValue = null;
        if (isset($product['meta']['_regular_price'])) {
            $regularPriceValue = $product['meta']['_regular_price'];
        } elseif (isset($product['meta']['_price'])) {
            $regularPriceValue = $product['meta']['_price'];
        }
        
        if ($regularPriceValue !== null && $regularPriceValue !== '') {
            $price = (float)$regularPriceValue;
            if ($price > 0) {
                $regularPrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($price)) . '</span>';
            }
        }
        
        if (isset($product['meta']['_sale_price']) && $product['meta']['_sale_price'] !== '') {
            $salePriceValue = (float)$product['meta']['_sale_price'];
            if ($salePriceValue > 0) {
                $regularPriceNum = $regularPriceValue ? (float)$regularPriceValue : 0;
                if ($salePriceValue < $regularPriceNum || $regularPriceNum === 0) {
                    $salePrice = '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>' . number_format(round($salePriceValue)) . '</span>';
                }
            }
        }
    }
    
    // Get stock from meta
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
    
    $formattedProducts[] = [
        'id' => $product['id'],
        'databaseId' => $product['id'],
        'sku' => $product['slug'] ?? 'product-' . $product['id'],
        'slug' => $product['slug'],
        'name' => $product['title']['rendered'] ?? $product['title'] ?? '',
        'description' => $product['content']['rendered'] ?? $product['content'] ?? '',
        'regularPrice' => $regularPrice,
        'salePrice' => $salePrice,
        'stockQuantity' => $stockQuantity,
        'stockStatus' => $stockStatus,
        'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null,
        'galleryImages' => ['nodes' => $galleryImages],
        'allPaStyle' => ['nodes' => []],
        'link' => $product['link'] ?? '',
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
