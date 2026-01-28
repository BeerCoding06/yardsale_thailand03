<?php
/**
 * Get Products from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getProducts.php
 * Query params: page, per_page, search, category, order, orderby
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

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

// Build WooCommerce API parameters
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

// Build WooCommerce API URL (use consumer_key/consumer_secret in query params)
$url = buildWcApiUrl('wc/v3/products', $params);

// Log the URL (without secret for security)
$logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
error_log('[getProducts] Fetching from WooCommerce API: ' . $logUrl);

// Fetch from WooCommerce API (no Basic Auth needed - uses query params)
$result = fetchWooCommerceApi($url, 'GET', null, false);

if (!$result['success']) {
    $errorMsg = 'Failed to fetch products';
    if (!empty($result['error'])) {
        $errorMsg = $result['error'];
    } elseif (!empty($result['raw_response'])) {
        $errorMsg = 'API Error: ' . substr($result['raw_response'], 0, 200);
    }
    error_log('[getProducts] WooCommerce API error: ' . $errorMsg . ' (HTTP ' . ($result['http_code'] ?? 'N/A') . ')');
    
    // Return empty array instead of error to prevent frontend from breaking
    // But log the error for debugging
    sendJsonResponse([
        'products' => [
            'nodes' => [],
            'pageInfo' => [
                'hasNextPage' => false,
                'endCursor' => null
            ]
        ],
        'error' => $errorMsg,
        'debug' => [
            'http_code' => $result['http_code'] ?? 0,
            'url' => $logUrl
        ]
    ]);
}

$products = $result['data'] ?? [];

// Validate response
if (!is_array($products)) {
    error_log('[getProducts] Invalid response format. Expected array, got: ' . gettype($products));
    error_log('[getProducts] Raw response: ' . substr($result['raw_response'] ?? '', 0, 500));
    
    // Return with debug info
    sendJsonResponse([
        'products' => [
            'nodes' => [],
            'pageInfo' => [
                'hasNextPage' => false,
                'endCursor' => null
            ]
        ],
        'error' => 'Invalid response format from API',
        'debug' => [
            'response_type' => gettype($products),
            'raw_response' => substr($result['raw_response'] ?? '', 0, 500)
        ]
    ]);
}

error_log('[getProducts] Successfully fetched ' . count($products) . ' products');

if (empty($products)) {
    error_log('[getProducts] WARNING: No products returned from API');
    error_log('[getProducts] API URL: ' . $logUrl);
    error_log('[getProducts] HTTP Code: ' . ($result['http_code'] ?? 'N/A'));
    error_log('[getProducts] Raw response: ' . substr($result['raw_response'] ?? '', 0, 1000));
}

// Format products to match expected structure (WooCommerce API has price/stock built-in)
$formattedProducts = [];

if (empty($products)) {
    error_log('[getProducts] No products returned from API');
}

foreach ($products as $product) {
    // Validate product structure
    if (!is_array($product)) {
        error_log('[getProducts] Invalid product format: ' . gettype($product));
        continue;
    }
    
    if (empty($product['id'])) {
        error_log('[getProducts] Product missing ID: ' . json_encode($product));
        continue;
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
    
    // Get image from WooCommerce API
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
$response = [
    'products' => [
        'nodes' => $formattedProducts,
        'pageInfo' => [
            'hasNextPage' => $hasNextPage,
            'endCursor' => $endCursor
        ]
    ]
];

// Add debug info if no products found
if (empty($formattedProducts)) {
    $response['debug'] = [
        'raw_products_count' => count($products),
        'api_url' => $logUrl,
        'http_code' => $result['http_code'] ?? 'N/A',
        'api_response_sample' => !empty($products) && is_array($products) && count($products) > 0 
            ? [
                'first_product_keys' => array_keys($products[0]),
                'first_product_id' => $products[0]['id'] ?? 'N/A',
                'first_product_name' => $products[0]['name'] ?? 'N/A'
            ]
            : 'No products in response'
    ];
}

sendJsonResponse($response);

?>
