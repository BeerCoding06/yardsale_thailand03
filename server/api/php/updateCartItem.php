<?php
// API for updating WooCommerce cart item quantity

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Load WordPress
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wp-load.php';
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress not found']);
    exit();
}

require_once $wp_load_path;

// Check if WooCommerce is active
if (!class_exists('WooCommerce')) {
    http_response_code(500);
    echo json_encode(['error' => 'WooCommerce is not active']);
    exit();
}

// Initialize WooCommerce cart if not already initialized
if (!WC()->cart) {
    wc_load_cart();
}

// Get JSON input
$raw_input = file_get_contents('php://input');
$input = json_decode($raw_input, true);

error_log('[updateCartItem] Raw input: ' . $raw_input);
error_log('[updateCartItem] Parsed input: ' . json_encode($input));

// Get items from input
$items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];

if (empty($items)) {
    http_response_code(400);
    echo json_encode(['error' => 'No items provided']);
    exit();
}

try {
    $updated_items = [];
    $removed_items = [];
    
    foreach ($items as $item) {
        $key = isset($item['key']) ? $item['key'] : null;
        $quantity = isset($item['quantity']) ? intval($item['quantity']) : 0;
        
        if (!$key) {
            continue;
        }
        
        // Get cart item
        $cart_item = WC()->cart->get_cart_item($key);
        
        if (!$cart_item) {
            error_log('[updateCartItem] Cart item not found: ' . $key);
            continue;
        }
        
        // If quantity is 0 or less, remove the item
        if ($quantity <= 0) {
            $removed = WC()->cart->remove_cart_item($key);
            if ($removed) {
                $removed_items[] = $key;
                error_log('[updateCartItem] Removed cart item: ' . $key);
            }
            continue;
        }
        
        // Update quantity
        $updated = WC()->cart->set_quantity($key, $quantity, true);
        
        if ($updated) {
            $updated_items[] = [
                'key' => $key,
                'quantity' => $quantity
            ];
            error_log('[updateCartItem] Updated cart item: ' . $key . ' to quantity: ' . $quantity);
        } else {
            error_log('[updateCartItem] Failed to update cart item: ' . $key);
        }
    }
    
    // Calculate totals
    WC()->cart->calculate_totals();
    
    // Return success response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Cart updated successfully',
        'updated_items' => $updated_items,
        'removed_items' => $removed_items,
        'cart_total' => WC()->cart->get_total(''),
        'cart_count' => WC()->cart->get_cart_contents_count()
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to update cart: ' . $e->getMessage();
    error_log('[updateCartItem] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message
    ], JSON_UNESCAPED_UNICODE);
}

