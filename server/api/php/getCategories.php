<?php
/**
 * Get Categories from WooCommerce REST API
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
// WooCommerce API requires lowercase for order parameter (asc/desc)
$order = isset($_GET['order']) ? strtolower($_GET['order']) : 'asc';

error_log('[getCategories] Query params - parent: ' . $parent . ', hide_empty: ' . ($hide_empty ? 'true' : 'false') . ', orderby: ' . $orderby . ', order: ' . $order);

// Build WooCommerce API URL for categories
$queryParams = [
    'per_page' => 100,
    'page' => 1,
    'orderby' => $orderby,
    'order' => $order,
    'parent' => $parent
];

// WooCommerce API v3 may not support hide_empty parameter, so we'll skip it
// Categories will be filtered client-side if needed

// Use WooCommerce API v3 for categories
$url = buildWcApiUrl('wc/v3/products/categories', $queryParams, true); // Use Basic Auth

// Log the URL
$logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
error_log('[getCategories] Fetching from WooCommerce API: ' . $logUrl);
error_log('[getCategories] WP_BASIC_AUTH configured: ' . (!empty(WP_BASIC_AUTH) ? 'Yes (length: ' . strlen(WP_BASIC_AUTH) . ')' : 'No - This may cause authentication failure'));

// Check if WP_BASIC_AUTH is configured
if (empty(WP_BASIC_AUTH)) {
    error_log('[getCategories] WARNING: WP_BASIC_AUTH is not configured. WooCommerce API may fail.');
    error_log('[getCategories] Please set WP_BASIC_AUTH environment variable (format: username:password)');
}

// Fetch from WooCommerce API (with Basic Auth)
$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    $errorMsg = $result['error'] ?? 'Failed to fetch categories';
    $httpCode = $result['http_code'] ?? 0;
    $rawResponse = $result['raw_response'] ?? '';
    
    error_log('[getCategories] WooCommerce API error: ' . $errorMsg . ' (HTTP ' . $httpCode . ')');
    error_log('[getCategories] API URL: ' . $logUrl);
    error_log('[getCategories] Raw response (first 500 chars): ' . substr($rawResponse, 0, 500));
    
    // Provide more helpful error message
    $userFriendlyError = $errorMsg;
    if ($httpCode === 401 || $httpCode === 403) {
        $userFriendlyError = 'Authentication failed. Please check WP_BASIC_AUTH configuration.';
    } elseif ($httpCode === 0 || empty($httpCode)) {
        $userFriendlyError = 'Connection failed. Please check network connection and WC_BASE_URL.';
    }
    
    // Return error response
    sendJsonResponse([
        'productCategories' => [
            'nodes' => []
        ],
        'error' => $userFriendlyError,
        'debug' => [
            'http_code' => $httpCode,
            'url' => $logUrl,
            'raw_response' => substr($rawResponse, 0, 500),
            'wp_basic_auth_configured' => !empty(WP_BASIC_AUTH),
            'wp_base_url' => WC_BASE_URL,
            'original_error' => $errorMsg
        ]
    ]);
}

$categories = $result['data'] ?? [];

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
    // Don't include hide_empty as WooCommerce API may not support it
    
    $allCategoriesUrl = buildWcApiUrl('wc/v3/products/categories', $allCategoriesParams, true); // Use Basic Auth
    $allCategoriesLogUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $allCategoriesUrl);
    error_log('[getCategories] Pre-fetching all categories: ' . $allCategoriesLogUrl);
    
    $allCategoriesResult = fetchWooCommerceApi($allCategoriesUrl, 'GET', null, true); // Use Basic Auth
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
                    'image' => $child['image'] ? ['sourceUrl' => $child['image']['src'] ?? $child['image']] : null,
                    'parent' => $child['parent'] ?? null,
                    'count' => $child['count'] ?? 0
                ];
            }
        }
        error_log('[getCategories] Pre-fetched ' . count($allCategoriesResult['data']) . ' total categories, grouped into ' . count($allChildren) . ' parent groups');
    }
}

foreach ($categories as $category) {
    // WooCommerce API returns image as object with 'src' property
    $imageUrl = null;
    if (!empty($category['image'])) {
        if (is_array($category['image']) && isset($category['image']['src'])) {
            $imageUrl = $category['image']['src'];
        } elseif (is_string($category['image'])) {
            $imageUrl = $category['image'];
        }
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
            // Don't include hide_empty as WooCommerce API may not support it
            
            $childrenUrl = buildWcApiUrl('wc/v3/products/categories', $childrenParams, true); // Use Basic Auth
            $childrenResult = fetchWooCommerceApi($childrenUrl, 'GET', null, true); // Use Basic Auth
            
            $childrenData = $childrenResult['success'] ? ($childrenResult['data'] ?? []) : [];
            if (is_array($childrenData)) {
                foreach ($childrenData as $child) {
                    $childImageUrl = null;
                    if (!empty($child['image'])) {
                        if (is_array($child['image']) && isset($child['image']['src'])) {
                            $childImageUrl = $child['image']['src'];
                        } elseif (is_string($child['image'])) {
                            $childImageUrl = $child['image'];
                        }
                    }
                    
                    $children[] = [
                        'id' => $child['id'],
                        'databaseId' => $child['id'],
                        'name' => $child['name'],
                        'slug' => $child['slug'],
                        'description' => $child['description'] ?? '',
                        'image' => $childImageUrl ? ['sourceUrl' => $childImageUrl] : null,
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
