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
$hide_empty = isset($_GET['hide_empty']) ? $_GET['hide_empty'] !== 'false' : true;
$orderby = isset($_GET['orderby']) ? $_GET['orderby'] : 'name';
$order = isset($_GET['order']) ? strtoupper($_GET['order']) : 'ASC';

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

// Log the URL
$logUrl = $url;
error_log('[getCategories] Fetching from WordPress API: ' . $logUrl);

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
foreach ($categories as $category) {
    $imageUrl = null;
    if (!empty($category['image'])) {
        $imageUrl = $category['image'];
    }
    
    // Get children categories
    $children = [];
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

// Add debug info if no categories found
if (empty($formattedCategories)) {
    $response['debug'] = [
        'raw_categories_count' => count($categories),
        'api_url' => $logUrl,
        'http_code' => $result['http_code'] ?? 'N/A',
        'api_response_sample' => !empty($categories) && is_array($categories) && count($categories) > 0 
            ? [
                'first_category_keys' => array_keys($categories[0]),
                'first_category_id' => $categories[0]['id'] ?? 'N/A',
                'first_category_name' => $categories[0]['name'] ?? 'N/A'
            ]
            : 'No categories in response',
        'wp_basic_auth_configured' => !empty(WP_BASIC_AUTH)
    ];
}

sendJsonResponse($response);

?>
