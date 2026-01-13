<?php
// API for checking if a product has been purchased (has orders)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get product ID from query parameter
$product_id = isset($_GET['product_id']) ? intval($_GET['product_id']) : null;

if (!$product_id || $product_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'product_id is required and must be a valid number']);
    exit();
}

// Load WordPress
$wp_load_path = __DIR__ . '/../../../wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wordpress/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found']);
    exit();
}
require_once($wp_load_path);

// Check if WooCommerce is active
if (!class_exists('WooCommerce')) {
    http_response_code(500);
    echo json_encode(['error' => 'WooCommerce is not active']);
    exit();
}

try {
    global $wpdb;
    
    // Check if product exists
    $product = wc_get_product($product_id);
    if (!$product) {
        http_response_code(404);
        echo json_encode(['error' => 'Product not found']);
        exit();
    }
    
    // Get order IDs that contain this product
    $order_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT DISTINCT oi.order_id
         FROM {$wpdb->prefix}woocommerce_order_items oi
         INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
         WHERE oi.order_item_type = 'line_item'
         AND oim.meta_key = '_product_id'
         AND oim.meta_value = %d",
        $product_id
    ));
    
    $has_orders = false;
    $order_count = 0;
    
    if (!empty($order_ids)) {
        // Get orders using WooCommerce API to check order status
        $orders = wc_get_orders([
            'post__in' => $order_ids,
            'limit' => -1, // Get all orders
            'orderby' => 'date',
            'order' => 'DESC',
        ]);
        
        // Count only non-cancelled orders
        foreach ($orders as $order) {
            $order_status = $order->get_status();
            // Only count orders that are not cancelled, refunded, or failed
            if ($order_status !== 'cancelled' && $order_status !== 'refunded' && $order_status !== 'failed') {
                // Verify this order actually contains the product
                $order_has_product = false;
                foreach ($order->get_items() as $item) {
                    if ($item->get_product_id() == $product_id) {
                        $order_has_product = true;
                        break;
                    }
                }
                
                if ($order_has_product) {
                    $has_orders = true;
                    $order_count++;
                }
            }
        }
    }
    
    error_log('[checkProductHasOrders] Product ID: ' . $product_id . ', Has orders: ' . ($has_orders ? 'true' : 'false') . ', Order count: ' . $order_count);
    
    echo json_encode([
        'success' => true,
        'product_id' => $product_id,
        'has_orders' => $has_orders,
        'order_count' => intval($order_count)
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
    error_log('[checkProductHasOrders] Error: ' . $e->getMessage());
}

