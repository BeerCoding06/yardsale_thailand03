<?php
/**
 * Get Categories from WordPress REST API
 * 
 * Endpoint: GET /server/api/php/getCategories.php
 * Query params: parent, hide_empty, orderby, order
 */

require_once __DIR__ . '/config.php';

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

// Fetch from WordPress REST API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code !== 200) {
    sendErrorResponse('Failed to fetch categories', $http_code ?: 500);
}

$categories = json_decode($response, true);

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
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $childrenUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $childrenResponse = curl_exec($ch);
        curl_close($ch);
        
        $childrenData = json_decode($childrenResponse, true);
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
