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

error_log('[getProducts] Category parameter: ' . ($category ?? 'null'));

// Map orderby to WooCommerce format
$orderbyMap = [
    'date' => 'date',
    'title' => 'title',
    'price' => 'price',
    'rating' => 'rating',
    'popularity' => 'popularity'
];
$wcOrderby = isset($orderbyMap[$orderby]) ? $orderbyMap[$orderby] : 'date';

// If category is provided, try to find category ID by name or slug
$categoryId = null;
if ($category) {
    // First, check if category is already a numeric ID
    if (is_numeric($category)) {
        $categoryId = (int)$category;
        error_log('[getProducts] Category is numeric ID: ' . $categoryId);
    } else {
        // Category is a name or slug, need to find the ID
        error_log('[getProducts] Looking up category by name/slug: ' . $category);
        
        // Fetch all categories to find matching one by name or slug
        // WooCommerce API search parameter may not work well, so fetch all and filter
        $categoriesUrl = buildWcApiUrl('wc/v3/products/categories', [
            'per_page' => 100
        ], true); // Use Basic Auth
        
        $categoriesResult = fetchWooCommerceApi($categoriesUrl, 'GET', null, true);
        
        if ($categoriesResult['success'] && is_array($categoriesResult['data'])) {
            $searchCategory = strtolower(trim($category));
            
            // Try to find category by name or slug with flexible matching
            foreach ($categoriesResult['data'] as $cat) {
                $catName = strtolower(trim($cat['name'] ?? ''));
                $catSlug = strtolower(trim($cat['slug'] ?? ''));
                
                // Exact match
                if ($catName === $searchCategory || $catSlug === $searchCategory) {
                    $categoryId = (int)$cat['id'];
                    error_log('[getProducts] Found category ID (exact match): ' . $categoryId . ' for: ' . $category);
                    break;
                }
                
                // Flexible matching - handle spaces, hyphens, underscores
                $normalizedCatName = str_replace([' ', '_'], '-', $catName);
                $normalizedSearch = str_replace([' ', '_'], '-', $searchCategory);
                
                if ($normalizedCatName === $normalizedSearch || 
                    $catSlug === $normalizedSearch ||
                    str_replace('-', ' ', $catName) === str_replace('-', ' ', $searchCategory)) {
                    $categoryId = (int)$cat['id'];
                    error_log('[getProducts] Found category ID (flexible match): ' . $categoryId . ' for: ' . $category);
                    break;
                }
            }
            
            if (!$categoryId) {
                error_log('[getProducts] WARNING: Category not found: ' . $category);
                error_log('[getProducts] Searched in ' . count($categoriesResult['data']) . ' categories');
            }
        } else {
            error_log('[getProducts] Failed to fetch categories for lookup');
        }
    }
}

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

// Use category ID if found, otherwise use original category parameter (might be ID already)
if ($categoryId) {
    $params['category'] = $categoryId;
    error_log('[getProducts] Using category ID: ' . $categoryId);
} elseif ($category) {
    // If category is numeric, use it directly
    if (is_numeric($category)) {
        $params['category'] = (int)$category;
    } else {
        error_log('[getProducts] WARNING: Category not found, filtering may not work: ' . $category);
        // Still try to use it, WooCommerce might accept it
        $params['category'] = $category;
    }
}

// Build WooCommerce API URL (use Basic Auth instead of query params)
// Postman shows that Basic Auth works, so we'll use that
$url = buildWcApiUrl('wc/v3/products', $params, true); // true = use Basic Auth

// Ensure URL doesn't have trailing slash (WooCommerce API is sensitive to this)
$url = rtrim($url, '/');

// Log the URL (without secret for security)
$logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
error_log('[getProducts] Fetching from WooCommerce API: ' . $logUrl);
error_log('[getProducts] Using Basic Auth: ' . (!empty(WP_BASIC_AUTH) ? 'Yes' : 'No'));

// Fetch from WooCommerce API (use Basic Auth like Postman)
$result = fetchWooCommerceApi($url, 'GET', null, true); // true = use Basic Auth

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
    error_log('[getProducts] Success: ' . ($result['success'] ? 'Yes' : 'No'));
    error_log('[getProducts] Error: ' . ($result['error'] ?? 'None'));
    error_log('[getProducts] Response type: ' . gettype($result['data']));
    if (!empty($result['raw_response'])) {
        error_log('[getProducts] Raw response (first 1000 chars): ' . substr($result['raw_response'], 0, 1000));
    }
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
