<?php
/**
 * Get Categories from WordPress REST API
 * 
 * Endpoint: GET /server/api/php/getCategories.php
 * Query params: parent, hide_empty, orderby, order
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get query parameters
$parent = isset($_GET['parent']) ? (int)$_GET['parent'] : 0;
// Default hide_empty to false to show all categories (even if they have no products)
$hide_empty = isset($_GET['hide_empty']) ? $_GET['hide_empty'] !== 'false' : false;
$orderby = isset($_GET['orderby']) ? $_GET['orderby'] : 'name';
$order = isset($_GET['order']) ? strtoupper($_GET['order']) : 'ASC';

error_log('[getCategories] Query params - parent: ' . $parent . ', hide_empty: ' . ($hide_empty ? 'true' : 'false') . ', orderby: ' . $orderby . ', order: ' . $order);

// Build WordPress REST API URL (categories are from WordPress, not WooCommerce)
$baseUrl = rtrim(WC_BASE_URL, '/');
$url = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query([
    'per_page' => 100,
    'page' => 1,
    'orderby' => $orderby,
    'order' => $order,
    'hide_empty' => $hide_empty ? '1' : '0',
    'parent' => $parent
]);

// Remove trailing slash
$url = rtrim($url, '/');

// Log the URL
$logUrl = $url;
error_log('[getCategories] Fetching from WordPress API: ' . $logUrl);
error_log('[getCategories] WP_BASIC_AUTH configured: ' . (!empty(WP_BASIC_AUTH) ? 'Yes' : 'No'));

// Fetch from WordPress REST API (with Basic Auth)
$result = fetchWordPressApi($url, 'GET');

if (!$result['success']) {
    $errorMsg = $result['error'] ?? 'Failed to fetch categories';
    error_log('[getCategories] WordPress API error: ' . $errorMsg . ' (HTTP ' . ($result['http_code'] ?? 'N/A') . ')');
    
    // Return empty array instead of error
    sendJsonResponse([
        'productCategories' => [
            'nodes' => []
        ],
        'error' => $errorMsg,
        'debug' => [
            'http_code' => $result['http_code'] ?? 0,
            'url' => $logUrl
        ]
    ]);
}

$categories = $result['data'] ?? [];

if (!is_array($categories)) {
    error_log('[getCategories] Invalid response format. Expected array, got: ' . gettype($categories));
    error_log('[getCategories] Raw response: ' . substr($result['raw_response'] ?? '', 0, 500));
    
    sendJsonResponse([
        'productCategories' => [
            'nodes' => []
        ],
        'error' => 'Invalid response format from API',
        'debug' => [
            'response_type' => gettype($categories),
            'raw_response' => substr($result['raw_response'] ?? '', 0, 500)
        ]
    ]);
}

error_log('[getCategories] Successfully fetched ' . count($categories) . ' categories');

if (empty($categories)) {
    error_log('[getCategories] WARNING: No categories returned from API');
    error_log('[getCategories] API URL: ' . $logUrl);
    error_log('[getCategories] HTTP Code: ' . ($result['http_code'] ?? 'N/A'));
    error_log('[getCategories] Raw response: ' . substr($result['raw_response'] ?? '', 0, 1000));
}

// Format categories
$formattedCategories = [];

// If parent=0, we can fetch all children in one request instead of per-category
$allChildren = [];
if ($parent === 0) {
    // Fetch all categories (including children) in one request for better performance
    // Then filter to get only children (parent != 0)
    $allCategoriesUrl = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query([
        'per_page' => 100,
        'hide_empty' => $hide_empty ? '1' : '0'
    ]);
    
    $allCategoriesResult = fetchWordPressApi($allCategoriesUrl, 'GET');
    if ($allCategoriesResult['success'] && is_array($allCategoriesResult['data'])) {
        // Group children by parent ID (filter out parent categories)
        foreach ($allCategoriesResult['data'] as $child) {
            $parentId = $child['parent'] ?? 0;
            // Only include categories that have a parent (are children)
            if ($parentId > 0) {
                if (!isset($allChildren[$parentId])) {
                    $allChildren[$parentId] = [];
                }
                $allChildren[$parentId][] = [
                    'id' => $child['id'],
                    'databaseId' => $child['id'],
                    'name' => $child['name'],
                    'slug' => $child['slug'],
                    'description' => $child['description'] ?? '',
                    'image' => null,
                    'parent' => $child['parent'] ?? null,
                    'count' => $child['count'] ?? 0
                ];
            }
        }
        error_log('[getCategories] Pre-fetched ' . count($allCategoriesResult['data']) . ' total categories, grouped into ' . count($allChildren) . ' parent groups');
    }
}

foreach ($categories as $category) {
    $imageUrl = null;
    if (!empty($category['image'])) {
        $imageUrl = $category['image'];
    }
    
    // Get children categories - use pre-fetched data if available
    $children = [];
    if ($parent === 0 && isset($allChildren[$category['id']])) {
        // Use pre-fetched children
        $children = $allChildren[$category['id']];
    } elseif ($parent !== 0) {
        // For non-parent requests, fetch children individually
        if ($category['count'] > 0 || !$hide_empty) {
            $childrenUrl = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query([
                'parent' => $category['id'],
                'per_page' => 100,
                'hide_empty' => $hide_empty ? '1' : '0'
            ]);
            
            $childrenResult = fetchWordPressApi($childrenUrl, 'GET');
            
            $childrenData = $childrenResult['success'] ? ($childrenResult['data'] ?? []) : [];
            if (is_array($childrenData)) {
                foreach ($childrenData as $child) {
                    $children[] = [
                        'id' => $child['id'],
                        'databaseId' => $child['id'],
                        'name' => $child['name'],
                        'slug' => $child['slug'],
                        'description' => $child['description'] ?? '',
                        'image' => null,
                        'parent' => $child['parent'] ?? null,
                        'count' => $child['count'] ?? 0
                    ];
                }
            }
        }
    }
    
    $formattedCategories[] = [
        'id' => $category['id'],
        'databaseId' => $category['id'],
        'name' => $category['name'],
        'slug' => $category['slug'],
        'description' => $category['description'] ?? '',
        'image' => $imageUrl ? ['sourceUrl' => $imageUrl] : null,
        'parent' => $category['parent'] ?? null,
        'count' => $category['count'] ?? 0,
        'children' => ['nodes' => $children],
        'products' => ['nodes' => []]
    ];
}

// Return response
$response = [
    'productCategories' => [
        'nodes' => $formattedCategories
    ]
];

// Always add debug info for troubleshooting
$response['debug'] = [
    'raw_categories_count' => count($categories),
    'formatted_categories_count' => count($formattedCategories),
    'api_url' => $logUrl,
    'http_code' => $result['http_code'] ?? 'N/A',
    'parent_filter' => $parent,
    'hide_empty' => $hide_empty,
    'wp_basic_auth_configured' => !empty(WP_BASIC_AUTH),
    'api_response_sample' => !empty($categories) && is_array($categories) && count($categories) > 0 
        ? [
            'first_category_keys' => array_keys($categories[0]),
            'first_category_id' => $categories[0]['id'] ?? 'N/A',
            'first_category_name' => $categories[0]['name'] ?? 'N/A',
            'first_category_parent' => $categories[0]['parent'] ?? 'N/A'
        ]
        : 'No categories in response'
];

error_log('[getCategories] Returning response with ' . count($formattedCategories) . ' formatted categories');
error_log('[getCategories] Debug info: ' . json_encode($response['debug']));

sendJsonResponse($response);

?>
