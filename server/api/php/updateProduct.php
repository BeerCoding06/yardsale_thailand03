<?php
// API for updating WooCommerce products - sets status to 'pending' after update

// Allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Get POST body
$input = json_decode(file_get_contents('php://input'), true);

// Check for required fields
if (!isset($input['product_id']) || !isset($input['user_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: product_id, user_id']);
    exit();
}

$product_id = intval($input['product_id']);
$user_id = intval($input['user_id']);

// Load WordPress
$wp_load_path = dirname(__DIR__, 3) . '/wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress not found']);
    exit();
}

require_once $wp_load_path;

// Verify product exists and belongs to user
$post = get_post($product_id);
if (!$post || $post->post_type !== 'product') {
    http_response_code(404);
    echo json_encode(['error' => 'Product not found']);
    exit();
}

// Verify ownership
if (intval($post->post_author) !== $user_id) {
    http_response_code(403);
    echo json_encode(['error' => 'You do not have permission to edit this product']);
    exit();
}

// Load environment variables from .env file
$env_path = dirname(__DIR__, 2) . '/.env';
if (file_exists($env_path)) {
    $env_lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($env_lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
        }
    }
}

$base_url = $_ENV['BASE_URL'] ?? 'http://localhost/yardsale_thailand';
$wp_api_url = $_ENV['WP_MEDIA_HOST'] ?? rtrim($base_url, '/') . '/wordpress';
$wp_api_url = rtrim($wp_api_url, '/') . '/wp-json/wc/v3/products/' . $product_id;

$auth = $_ENV['WP_BASIC_AUTH'] ?? 'cGFyYWRvbl9wb2twaW5nbWF1bmc6eDRkTCA4QUp1IHQzSHkgZzIyMyA5aTViIG9hTnk=';

if (empty($auth)) {
    http_response_code(500);
    echo json_encode(['error' => 'WP_BASIC_AUTH is not set in .env file']);
    exit();
}

// Prepare update payload
$product_data = [];

// Add fields if provided
$fields = [
    'name', 'type', 'regular_price', 'sale_price', 'description', 
    'short_description', 'manage_stock', 'stock_quantity', 'categories', 
    'tags', 'sku'
];

foreach ($fields as $field) {
    if (isset($input[$field])) {
        $product_data[$field] = $input[$field];
    }
}

// Handle images if provided
if (isset($input['images']) && is_array($input['images'])) {
    $product_data['images'] = [];
    foreach ($input['images'] as $image) {
        if (is_string($image)) {
            // If it's a URL string
            $product_data['images'][] = ['src' => $image];
        } elseif (is_array($image) && isset($image['src'])) {
            // If it's already an object with src
            $product_data['images'][] = ['src' => $image['src']];
        }
    }
}

// Always set status to 'pending' after update
$product_data['status'] = 'pending';

// Update product via WooCommerce REST API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $wp_api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($product_data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Basic ' . $auth
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($curl_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'CURL error: ' . $curl_error
    ]);
    exit();
}

if ($http_code !== 200) {
    $error_data = json_decode($response, true);
    $error_message = $error_data['message'] ?? 'Failed to update product';
    
    http_response_code($http_code);
    echo json_encode([
        'success' => false,
        'error' => $error_message,
        'details' => $error_data
    ]);
    exit();
}

$updated_product = json_decode($response, true);

// After updating via REST API, we need to ensure the lookup table is updated
// WooCommerce should do this automatically, but we'll force it to be sure
// The lookup table (wp_wc_product_meta_lookup) stores min_price and max_price
if (function_exists('wc_get_product')) {
    $wc_product = wc_get_product($product_id);
    if ($wc_product) {
        // Get the data store to update lookup table
        $data_store = $wc_product->get_data_store();
        if ($data_store && method_exists($data_store, 'update_lookup_table')) {
            // Update the lookup table for this product
            // This will update min_price and max_price in wp_wc_product_meta_lookup
            $data_store->update_lookup_table($product_id, 'wc_product_meta_lookup');
        }
        
        // Also manually update min_max_price column if function exists
        // This ensures the lookup table is updated immediately
        if (function_exists('wc_update_product_lookup_tables_column')) {
            // Update min_max_price column in lookup table
            // This reads from _price meta and updates min_price and max_price
            wc_update_product_lookup_tables_column('min_max_price');
        } else {
            // Fallback: manually update lookup table
            global $wpdb;
            $lookup_table = $wpdb->prefix . 'wc_product_meta_lookup';
            
            // Get the current _price meta values (can be multiple for variable products)
            $price_meta = get_post_meta($product_id, '_price', false);
            if (!empty($price_meta)) {
                // Calculate min and max prices from all _price meta values
                $prices = array_filter(array_map('floatval', $price_meta));
                if (!empty($prices)) {
                    $min_price = min($prices);
                    $max_price = max($prices);
                    
                    // Update lookup table directly
                    $wpdb->update(
                        $lookup_table,
                        [
                            'min_price' => $min_price,
                            'max_price' => $max_price
                        ],
                        ['product_id' => $product_id],
                        ['%f', '%f'],
                        ['%d']
                    );
                }
            }
        }
    }
}

// Return success response
echo json_encode([
    'success' => true,
    'message' => 'Product updated successfully. Status changed to pending for review.',
    'product' => [
        'id' => $updated_product['id'] ?? $product_id,
        'name' => $updated_product['name'] ?? '',
        'status' => $updated_product['status'] ?? 'pending'
    ]
]);

