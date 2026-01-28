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

// Fetch from WordPress REST API (with Basic Auth)
$result = fetchWordPressApi($url, 'GET');

if (!$result['success']) {
    sendErrorResponse($result['error'] ?? 'Failed to fetch categories', $result['http_code'] ?: 500);
}

$categories = $result['data'] ?? [];

if (!is_array($categories)) {
    $categories = [];
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
sendJsonResponse([
    'productCategories' => [
        'nodes' => $formattedCategories
    ]
]);

?>
