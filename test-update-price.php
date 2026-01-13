<?php
// Test script to update product price directly
// Usage: php test-update-price.php <product_id> <user_id>

// Get command line arguments
$product_id = isset($argv[1]) ? intval($argv[1]) : null;
$user_id = isset($argv[2]) ? intval($argv[2]) : null;

if (!$product_id || !$user_id) {
    echo "Usage: php test-update-price.php <product_id> <user_id>\n";
    echo "Example: php test-update-price.php 1023 7\n";
    exit(1);
}

// Prepare payload
$payload = [
    'product_id' => $product_id,
    'user_id' => $user_id,
    'regular_price' => '50000',
    'sale_price' => '30000',
];

// API endpoint
$api_url = 'http://localhost/yardsale_thailand/server/api/php/updateProduct.php';

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
echo "Response: $response\n";

$result = json_decode($response, true);
if ($result) {
    echo "\nResult:\n";
    print_r($result);
}

