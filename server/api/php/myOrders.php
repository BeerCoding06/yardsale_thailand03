<?php
// API for fetching customer orders from WooCommerce with shipping status

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get customer ID from query parameter
$customer_id = isset($_GET['customer_id']) ? intval($_GET['customer_id']) : null;
$customer_email = isset($_GET['customer_email']) ? trim($_GET['customer_email']) : null;

if (!$customer_id && !$customer_email) {
    http_response_code(400);
    echo json_encode(['error' => 'customer_id or customer_email is required']);
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
    // Build query args for wc_get_orders
    $query_args = [
        'limit' => 100,
        'orderby' => 'date',
        'order' => 'DESC',
    ];
    
    if ($customer_id) {
        $query_args['customer_id'] = $customer_id;
    } elseif ($customer_email) {
        // Find customer ID by email
        $user = get_user_by('email', $customer_email);
        if ($user) {
            $query_args['customer_id'] = $user->ID;
        } else {
            echo json_encode([
                'success' => true,
                'count' => 0,
                'orders' => []
            ], JSON_UNESCAPED_UNICODE);
            exit();
        }
    }
    
    // Get orders using WooCommerce API
    $orders = wc_get_orders($query_args);
    
    // Format orders data with shipping information
    $orders_data = [];
    foreach ($orders as $order) {
        // Get line items
        $line_items = [];
        foreach ($order->get_items() as $item_id => $item) {
            $product = $item->get_product();
            $image_url = '';
            
            if ($product) {
                $image_id = $product->get_image_id();
                if ($image_id) {
                    $image_url = wp_get_attachment_image_url($image_id, 'thumbnail');
                    if (!$image_url) {
                        $image_url = wp_get_attachment_image_url($image_id, 'full');
                    }
                }
            }
            
            $line_items[] = [
                'id' => $item_id,
                'product_id' => $item->get_product_id(),
                'name' => $item->get_name(),
                'quantity' => $item->get_quantity(),
                'total' => $item->get_total(),
                'image' => $image_url,
            ];
        }
        
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
            'total' => $order->get_total(),
            'payment_method' => $order->get_payment_method(),
            'payment_method_title' => $order->get_payment_method_title(),
            'billing' => [
                'first_name' => $order->get_billing_first_name(),
                'last_name' => $order->get_billing_last_name(),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
                'address_1' => $order->get_billing_address_1(),
                'address_2' => $order->get_billing_address_2(),
                'city' => $order->get_billing_city(),
                'state' => $order->get_billing_state(),
                'postcode' => $order->get_billing_postcode(),
                'country' => $order->get_billing_country(),
            ],
            'line_items' => $line_items,
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'count' => count($orders_data),
        'orders' => $orders_data,
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to fetch orders: ' . $e->getMessage();
    error_log('[myOrders] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[myOrders] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

