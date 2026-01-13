<?php
// Test script to update product price directly for product ID 1207
// This will get the user_id from the product first

// Load WordPress
$wp_load_path = dirname(__FILE__) . '/wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = dirname(__FILE__, 2) . '/wordpress/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    $wp_load_path = dirname(__FILE__, 3) . '/wordpress/wp-load.php';
}

if (!file_exists($wp_load_path)) {
    echo "WordPress not found. Please check the path.\n";
    exit(1);
}

require_once $wp_load_path;

$product_id = 1207;

// Get product to find user_id
$post = get_post($product_id);
if (!$post || $post->post_type !== 'product') {
    echo "Product not found: $product_id\n";
    exit(1);
}

$user_id = intval($post->post_author);
echo "Product ID: $product_id\n";
echo "User ID: $user_id\n";
echo "Setting regular_price: 50000\n";
echo "Setting sale_price: 30000\n";
echo "\n";

// Prepare payload
$payload = [
    'product_id' => $product_id,
    'user_id' => $user_id,
    'regular_price' => '50000',
    'sale_price' => '30000',
];

// API endpoint
$base_url = 'http://localhost/yardsale_thailand';
$api_url = $base_url . '/server/api/php/updateProduct.php';

echo "Calling API: $api_url\n";
echo "Payload: " . json_encode($payload, JSON_PRETTY_PRINT) . "\n\n";

// Make request
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

echo "HTTP Code: $http_code\n";
if ($curl_error) {
    echo "CURL Error: $curl_error\n";
}
echo "Response:\n$response\n";

$result = json_decode($response, true);
if ($result) {
    echo "\nParsed Result:\n";
    print_r($result);
    
    if (isset($result['success']) && $result['success']) {
        echo "\n✅ Price updated successfully!\n";
    } else {
        echo "\n❌ Failed to update price.\n";
    }
}

