<?php
// API for adding products to WooCommerce cart

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

// Get JSON input
$raw_input = file_get_contents('php://input');
$input = json_decode($raw_input, true);

// Log input for debugging
error_log('[addToCart] Raw input: ' . $raw_input);
error_log('[addToCart] Parsed input: ' . json_encode($input));

$product_id = isset($input['productId']) ? intval($input['productId']) : null;
$quantity = isset($input['quantity']) ? intval($input['quantity']) : 1;
$variation_id = isset($input['variationId']) ? intval($input['variationId']) : null;
$variation = isset($input['variation']) ? $input['variation'] : array();

error_log('[addToCart] product_id: ' . $product_id . ', quantity: ' . $quantity);

if (!$product_id || $product_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'productId is required and must be a valid number']);
    exit();
}

try {
    // Get product
    $product = wc_get_product($product_id);
    
    if (!$product) {
        error_log('[addToCart] Product not found for ID: ' . $product_id);
        http_response_code(404);
        echo json_encode(['error' => 'Product not found']);
        exit();
    }
    
    error_log('[addToCart] Product found: ' . $product->get_name() . ' (ID: ' . $product_id . ', Type: ' . $product->get_type() . ')');
    
    // Only allow simple products
    if ($product->get_type() !== 'simple') {
        error_log('[addToCart] Product type is not simple: ' . $product->get_type());
        http_response_code(400);
        echo json_encode(['error' => 'Only simple products are supported']);
        exit();
    }
    
    // Check if product is purchasable
    if (!$product->is_purchasable()) {
        error_log('[addToCart] Product is not purchasable');
        http_response_code(400);
        echo json_encode(['error' => 'Product is not purchasable']);
        exit();
    }
    
    // Initialize WooCommerce cart if not already initialized
    if (!WC()->cart) {
        wc_load_cart();
    }
    
    // Add to cart
    error_log('[addToCart] Attempting to add to cart...');
    $cart_item_key = WC()->cart->add_to_cart($product_id, $quantity, $variation_id, $variation);
    
    if (!$cart_item_key) {
        $notices = WC()->session->get('wc_notices');
        $error_message = 'Failed to add product to cart';
        if (!empty($notices['error'])) {
            $error_message = implode(' ', array_column($notices['error'], 'notice'));
            wc_clear_notices();
        }
        error_log('[addToCart] Failed to add to cart: ' . $error_message);
        http_response_code(400);
        echo json_encode(['error' => $error_message]);
        exit();
    }
    
    error_log('[addToCart] Successfully added to cart, key: ' . $cart_item_key);
    
    // Get cart item
    $cart_item = WC()->cart->get_cart_item($cart_item_key);
    
    if (!$cart_item) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to retrieve cart item']);
        exit();
    }
    
    // Get product data
    $cart_product = $cart_item['data'];
    $sku = $cart_product->get_sku();
    $slug = $cart_product->get_slug();
    $name = $cart_product->get_name();
    $regular_price = $cart_product->get_regular_price();
    $sale_price = $cart_product->get_sale_price();
    $stock_quantity = $cart_product->get_stock_quantity();
    $stock_status = $cart_product->get_stock_status();
    
    // If product is cancelled, show as in stock
    $cart_product_status = $cart_product->get_status();
    if ($cart_product_status === 'cancelled') {
        $stock_status = 'instock';
    }
    
    // Get product image
    $image_id = $cart_product->get_image_id();
    $image_url = null;
    if ($image_id) {
        $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
        if (!$image_url) {
            $image_url = wp_get_attachment_image_url($image_id, 'full');
        }
    }
    
    // Build response in GraphQL-like format
    $response = array(
        'addToCart' => array(
            'cartItem' => array(
                'key' => $cart_item_key,
                'quantity' => $cart_item['quantity'],
                'product' => array(
                    'node' => array(
                        'sku' => $sku,
                        'slug' => $slug,
                        'name' => $name,
                        'databaseId' => $product_id,
                        'salePrice' => $sale_price ? $sale_price : null,
                        'regularPrice' => $regular_price ? $regular_price : null,
                        'stockQuantity' => $stock_quantity !== null ? intval($stock_quantity) : null,
                        'stockStatus' => $stock_status ? strtoupper($stock_status) : 'INSTOCK',
                        'image' => $image_url ? array('sourceUrl' => $image_url) : null,
                    )
                ),
                'variation' => null, // Simple products don't have variations
            )
        )
    );
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
    error_log('[addToCart] Error: ' . $e->getMessage());
}

