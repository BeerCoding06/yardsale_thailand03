<?php
/**
 * Debug endpoint to test API connections
 * 
 * Endpoint: GET /server/api/php/debug.php
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

$debug = [
    'timestamp' => date('Y-m-d H:i:s'),
    'config' => [
        'wc_base_url' => WC_BASE_URL,
        'wc_consumer_key' => WC_CONSUMER_KEY ? substr(WC_CONSUMER_KEY, 0, 20) . '...' : 'NOT SET',
        'wc_consumer_secret' => WC_CONSUMER_SECRET ? substr(WC_CONSUMER_SECRET, 0, 20) . '...' : 'NOT SET',
        'wp_basic_auth' => !empty(WP_BASIC_AUTH) ? 'SET' : 'NOT SET'
    ],
    'tests' => []
];

// Test 1: WooCommerce Products API
$test1Url = buildWcApiUrl('wc/v3/products', ['per_page' => 1]);
$logUrl1 = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $test1Url);
$debug['tests']['woocommerce_products'] = [
    'url' => $logUrl1,
    'status' => 'testing...'
];

$result1 = fetchWooCommerceApi($test1Url, 'GET', null, false);
$debug['tests']['woocommerce_products'] = [
    'url' => $logUrl1,
    'success' => $result1['success'],
    'http_code' => $result1['http_code'] ?? 0,
    'error' => $result1['error'] ?? null,
    'products_count' => is_array($result1['data']) ? count($result1['data']) : 0,
    'response_type' => gettype($result1['data']),
    'response_sample' => is_array($result1['data']) && count($result1['data']) > 0 
        ? [
            'id' => $result1['data'][0]['id'] ?? 'N/A',
            'name' => $result1['data'][0]['name'] ?? 'N/A',
            'has_price' => isset($result1['data'][0]['regular_price']),
            'has_stock' => isset($result1['data'][0]['stock_quantity'])
        ]
        : 'No products',
    'raw_response_preview' => substr($result1['raw_response'] ?? '', 0, 500)
];

// Test 2: WordPress Categories API
$test2Url = WC_BASE_URL . '/wp-json/wp/v2/product_cat?per_page=1';
$debug['tests']['wordpress_categories'] = [
    'url' => $test2Url,
    'status' => 'testing...'
];

$result2 = fetchWordPressApi($test2Url, 'GET');
$debug['tests']['wordpress_categories'] = [
    'url' => $test2Url,
    'success' => $result2['success'],
    'http_code' => $result2['http_code'] ?? 0,
    'error' => $result2['error'] ?? null,
    'categories_count' => is_array($result2['data']) ? count($result2['data']) : 0,
    'response_type' => gettype($result2['data']),
    'response_sample' => is_array($result2['data']) && count($result2['data']) > 0 
        ? [
            'id' => $result2['data'][0]['id'] ?? 'N/A',
            'name' => $result2['data'][0]['name'] ?? 'N/A'
        ]
        : 'No categories',
    'raw_response_preview' => substr($result2['raw_response'] ?? '', 0, 500)
];

sendJsonResponse($debug);

?>
