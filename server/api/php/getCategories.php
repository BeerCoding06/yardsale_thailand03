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

// WordPress REST API v2 uses boolean for hide_empty, not string
$queryParams = [
    'per_page' => 100,
    'page' => 1,
    'orderby' => $orderby,
    'order' => $order,
    'parent' => $parent
];

// Only add hide_empty if it's explicitly set (WordPress API may not support it in all versions)
// Try without hide_empty first, as it might cause 400 errors
if ($hide_empty === false) {
    // WordPress REST API expects boolean true/false, not string
    // But some versions may not support it, so we'll try without it first
    // $queryParams['hide_empty'] = false;
}

$url = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query($queryParams);

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
    $httpCode = $result['http_code'] ?? 0;
    $rawResponse = $result['raw_response'] ?? '';
    
    error_log('[getCategories] WordPress API error: ' . $errorMsg . ' (HTTP ' . $httpCode . ')');
    error_log('[getCategories] API URL: ' . $logUrl);
    error_log('[getCategories] Raw response (first 500 chars): ' . substr($rawResponse, 0, 500));
    
    // If 400 error, try without parent parameter (some WordPress versions may not support it)
    if ($httpCode === 400 && $parent === 0) {
        error_log('[getCategories] Trying fallback: fetch all categories without parent filter');
        $fallbackUrl = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query([
            'per_page' => 100,
            'page' => 1,
            'orderby' => $orderby,
            'order' => $order
        ]);
        
        $fallbackResult = fetchWordPressApi($fallbackUrl, 'GET');
        
        if ($fallbackResult['success'] && is_array($fallbackResult['data'])) {
            // Filter to get only parent categories (parent === 0)
            $categories = array_filter($fallbackResult['data'], function($cat) {
                return ($cat['parent'] ?? 0) === 0;
            });
            $categories = array_values($categories); // Re-index array
            error_log('[getCategories] Fallback successful: Got ' . count($categories) . ' parent categories');
        } else {
            $categories = [];
            error_log('[getCategories] Fallback also failed');
        }
    } else {
        $categories = [];
    }
    
    // If still no categories, return error
    if (empty($categories)) {
        sendJsonResponse([
            'productCategories' => [
                'nodes' => []
            ],
            'error' => $errorMsg,
            'debug' => [
                'http_code' => $httpCode,
                'url' => $logUrl,
                'raw_response' => substr($rawResponse, 0, 500),
                'wp_basic_auth_configured' => !empty(WP_BASIC_AUTH)
            ]
        ]);
    }
    // Continue with filtered categories if fallback worked
} else {
    $categories = $result['data'] ?? [];
}

// Ensure categories is an array
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
    $allCategoriesParams = [
        'per_page' => 100
    ];
    // Don't include hide_empty as it may cause 400 errors
    $allCategoriesUrl = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query($allCategoriesParams);
    
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
            $childrenParams = [
                'parent' => $category['id'],
                'per_page' => 100
            ];
            // Don't include hide_empty as it may cause 400 errors
            $childrenUrl = $baseUrl . '/wp-json/wp/v2/product_cat?' . http_build_query($childrenParams);
            
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
