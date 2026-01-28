<?php
/**
 * Test WooCommerce API Connection
 * 
 * Run this file to test if WooCommerce API is working correctly
 * Usage: php server/api/php/test-api.php
 */

require_once __DIR__ . '/config.php';

echo "=== Testing WooCommerce API Connection ===\n\n";

// Test 1: Check credentials
echo "1. Checking credentials...\n";
echo "   WC_BASE_URL: " . WC_BASE_URL . "\n";
echo "   WC_CONSUMER_KEY: " . (WC_CONSUMER_KEY ? substr(WC_CONSUMER_KEY, 0, 20) . '...' : 'NOT SET') . "\n";
echo "   WC_CONSUMER_SECRET: " . (WC_CONSUMER_SECRET ? substr(WC_CONSUMER_SECRET, 0, 20) . '...' : 'NOT SET') . "\n\n";

if (empty(WC_CONSUMER_KEY) || empty(WC_CONSUMER_SECRET)) {
    echo "❌ ERROR: WooCommerce credentials not configured!\n";
    echo "   Please set WP_CONSUMER_KEY and WP_CONSUMER_SECRET in .env file\n";
    exit(1);
}

// Test 2: Build API URL
echo "2. Building API URL...\n";
$url = buildWcApiUrl('wc/v3/products', ['per_page' => 1]);
$logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
echo "   URL: " . $logUrl . "\n\n";

// Test 3: Fetch products
echo "3. Fetching products from WooCommerce API...\n";
$result = fetchWooCommerceApi($url, 'GET', null, false);

if (!$result['success']) {
    echo "❌ ERROR: Failed to fetch products\n";
    echo "   HTTP Code: " . ($result['http_code'] ?? 'N/A') . "\n";
    echo "   Error: " . ($result['error'] ?? 'Unknown error') . "\n";
    if (!empty($result['raw_response'])) {
        echo "   Response: " . substr($result['raw_response'], 0, 500) . "\n";
    }
    exit(1);
}

$products = $result['data'] ?? [];

if (!is_array($products)) {
    echo "❌ ERROR: Invalid response format\n";
    echo "   Expected array, got: " . gettype($products) . "\n";
    if (!empty($result['raw_response'])) {
        echo "   Response: " . substr($result['raw_response'], 0, 500) . "\n";
    }
    exit(1);
}

echo "✅ Success! Found " . count($products) . " product(s)\n\n";

// Test 4: Display first product
if (count($products) > 0) {
    $product = $products[0];
    echo "4. First product details:\n";
    echo "   ID: " . ($product['id'] ?? 'N/A') . "\n";
    echo "   Name: " . ($product['name'] ?? 'N/A') . "\n";
    echo "   SKU: " . ($product['sku'] ?? 'N/A') . "\n";
    echo "   Regular Price: " . ($product['regular_price'] ?? 'N/A') . "\n";
    echo "   Sale Price: " . ($product['sale_price'] ?? 'N/A') . "\n";
    echo "   Stock Quantity: " . ($product['stock_quantity'] ?? 'N/A') . "\n";
    echo "   Stock Status: " . ($product['stock_status'] ?? 'N/A') . "\n";
    echo "   Has Images: " . (!empty($product['images']) ? 'Yes (' . count($product['images']) . ')' : 'No') . "\n";
    echo "\n";
}

echo "✅ All tests passed!\n";
echo "   WooCommerce API is working correctly.\n";

?>
