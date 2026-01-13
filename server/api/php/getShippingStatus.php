<?php
// API for fetching shipping status of orders

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
    
    // Format orders data with shipping information
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
                ];
            }
        }
        
        // Only include order if it has items from this seller
        if (!empty($seller_line_items)) {
            // Get shipping methods
            $shipping_methods = [];
            foreach ($order->get_items('shipping') as $item_id => $shipping_item) {
                $shipping_methods[] = [
                    'id' => $item_id,
                    'method_title' => $shipping_item->get_method_title(),
                    'method_id' => $shipping_item->get_method_id(),
                    'total' => $shipping_item->get_total(),
                ];
            }
            
            // Get shipping address
            $shipping_address = [
                'first_name' => $order->get_shipping_first_name(),
                'last_name' => $order->get_shipping_last_name(),
                'company' => $order->get_shipping_company(),
                'address_1' => $order->get_shipping_address_1(),
                'address_2' => $order->get_shipping_address_2(),
                'city' => $order->get_shipping_city(),
                'state' => $order->get_shipping_state(),
                'postcode' => $order->get_shipping_postcode(),
                'country' => $order->get_shipping_country(),
            ];
            
            // Get tracking number from meta (common plugins use this)
            $tracking_number = $order->get_meta('_tracking_number');
            if (empty($tracking_number)) {
                $tracking_number = $order->get_meta('tracking_number');
            }
            if (empty($tracking_number)) {
                $tracking_number = $order->get_meta('_wc_shipment_tracking_number');
            }
            
            // Get tracking provider
            $tracking_provider = $order->get_meta('_tracking_provider');
            if (empty($tracking_provider)) {
                $tracking_provider = $order->get_meta('tracking_provider');
            }
            
            // Get shipping date
            $date_shipped = $order->get_meta('_date_shipped');
            if (empty($date_shipped)) {
                $date_shipped = $order->get_meta('date_shipped');
            }
            
            // Determine shipping status based on order status
            $shipping_status = 'pending'; // default
            if ($order->get_status() === 'completed') {
                $shipping_status = 'delivered';
            } elseif ($order->get_status() === 'processing' && !empty($tracking_number)) {
                $shipping_status = 'shipped';
            } elseif ($order->get_status() === 'processing') {
                $shipping_status = 'preparing';
            } elseif ($order->get_status() === 'on-hold') {
                $shipping_status = 'on_hold';
            }
            
            $orders_data[] = [
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'date_created' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d H:i:s') : null,
                'date_shipped' => $date_shipped,
                'shipping_status' => $shipping_status,
                'shipping_methods' => $shipping_methods,
                'shipping_address' => $shipping_address,
                'tracking_number' => $tracking_number,
                'tracking_provider' => $tracking_provider,
                'billing' => [
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'email' => $order->get_billing_email(),
                    'phone' => $order->get_billing_phone(),
                ],
                'line_items' => $seller_line_items,
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
    $error_message = 'Failed to fetch shipping status: ' . $e->getMessage();
    error_log('[getShippingStatus] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[getShippingStatus] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

