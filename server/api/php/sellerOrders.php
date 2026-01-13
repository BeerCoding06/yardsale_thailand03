<?php
// API for fetching orders that contain products sold by a specific seller

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get seller ID from query parameter
$seller_id = isset($_GET['seller_id']) ? intval($_GET['seller_id']) : null;

if (!$seller_id) {
    http_response_code(400);
    echo json_encode(['error' => 'seller_id is required']);
    exit();
}

// Load WordPress
$wp_load_path = __DIR__ . '/../../../wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wordpress/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found.']);
    exit();
}
require_once($wp_load_path);

// Check if WooCommerce is active
if (!class_exists('WooCommerce')) {
    http_response_code(500);
    echo json_encode(['error' => 'WooCommerce is not active.']);
    exit();
}

if (!function_exists('wc_get_orders')) {
    http_response_code(500);
    echo json_encode(['error' => 'WooCommerce order functions not found.']);
    exit();
}

try {
    global $wpdb;
    
    // Get all product IDs that belong to this seller (post_author = seller_id)
    $product_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT ID FROM {$wpdb->posts} 
         WHERE post_author = %d 
         AND post_type = 'product' 
         AND post_status IN ('publish', 'pending', 'draft', 'private')",
        $seller_id
    ));
    
    if (empty($product_ids)) {
        // No products found for this seller
        echo json_encode([
            'success' => true,
            'count' => 0,
            'orders' => []
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }
    
    // Get order IDs that contain these products
    $product_ids_placeholders = implode(',', array_fill(0, count($product_ids), '%d'));
    $order_ids_query = $wpdb->prepare(
        "SELECT DISTINCT oi.order_id 
         FROM {$wpdb->prefix}woocommerce_order_items oi
         INNER JOIN {$wpdb->prefix}woocommerce_order_itemmeta oim ON oi.order_item_id = oim.order_item_id
         WHERE oi.order_item_type = 'line_item'
         AND oim.meta_key = '_product_id'
         AND oim.meta_value IN ($product_ids_placeholders)",
        ...$product_ids
    );
    
    $order_ids = $wpdb->get_col($order_ids_query);
    
    if (empty($order_ids)) {
        // No orders found
        echo json_encode([
            'success' => true,
            'count' => 0,
            'orders' => []
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }
    
    // Get orders using WooCommerce API
    $orders = wc_get_orders([
        'post__in' => $order_ids,
        'limit' => 100,
        'orderby' => 'date',
        'order' => 'DESC',
    ]);
    
    // Format orders data
    $orders_data = [];
    foreach ($orders as $order) {
        // Get only line items that belong to this seller's products
        $seller_line_items = [];
        foreach ($order->get_items() as $item_id => $item) {
            $product_id = $item->get_product_id();
            if (in_array($product_id, $product_ids)) {
                $seller_line_items[] = [
                    'id' => $item_id,
                    'product_id' => $product_id,
                    'name' => $item->get_name(),
                    'quantity' => $item->get_quantity(),
                    'total' => $item->get_total(),
                    'subtotal' => $item->get_subtotal(),
                ];
            }
        }
        
        // Only include order if it has items from this seller
        if (!empty($seller_line_items)) {
            // Check payment status
            $is_paid = $order->is_paid();
            $date_paid = $order->get_date_paid();
            
            $orders_data[] = [
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'date_created' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d H:i:s') : null,
                'date_paid' => $date_paid ? $date_paid->date('Y-m-d H:i:s') : null,
                'is_paid' => $is_paid,
                'total' => $order->get_total(),
                'currency' => $order->get_currency(),
                'payment_method' => $order->get_payment_method(),
                'payment_method_title' => $order->get_payment_method_title(),
                'transaction_id' => $order->get_transaction_id(),
                'customer_id' => $order->get_customer_id(),
                'billing' => [
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'email' => $order->get_billing_email(),
                    'phone' => $order->get_billing_phone(),
                ],
                'line_items' => $seller_line_items,
                'seller_total' => array_sum(array_column($seller_line_items, 'total')), // Total for seller's products only
            ];
        }
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'count' => count($orders_data),
        'orders' => $orders_data,
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to fetch seller orders: ' . $e->getMessage();
    error_log('[sellerOrders] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[sellerOrders] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

