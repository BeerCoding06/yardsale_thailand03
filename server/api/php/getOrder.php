<?php
// API for fetching WooCommerce order details

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get order ID from query parameter
$order_id = isset($_GET['order_id']) ? intval($_GET['order_id']) : null;
$customer_id = isset($_GET['customer_id']) ? intval($_GET['customer_id']) : null;

if (!$order_id) {
    http_response_code(400);
    echo json_encode(['error' => 'order_id is required']);
    exit();
}

// Load WordPress
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wp-load.php';
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

if (!function_exists('wc_get_order')) {
    http_response_code(500);
    echo json_encode(['error' => 'WooCommerce order functions not found.']);
    exit();
}

try {
    // Get order
    $order = wc_get_order($order_id);
    
    if (!$order || !$order->get_id()) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        exit();
    }
    
    // Verify ownership if customer_id is provided
    if ($customer_id) {
        $order_customer_id = $order->get_customer_id();
        if ($order_customer_id != $customer_id) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied. This order does not belong to you.']);
            exit();
        }
    }
    
    // Get order data
    $order_data = [
        'id' => $order->get_id(),
        'number' => $order->get_order_number(),
        'status' => $order->get_status(),
        'date_created' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d H:i:s') : null,
        'date_modified' => $order->get_date_modified() ? $order->get_date_modified()->date('Y-m-d H:i:s') : null,
        'total' => $order->get_total(),
        'currency' => $order->get_currency(),
        'payment_method' => $order->get_payment_method(),
        'payment_method_title' => $order->get_payment_method_title(),
        'customer_id' => $order->get_customer_id(),
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
        'shipping' => [
            'first_name' => $order->get_shipping_first_name(),
            'last_name' => $order->get_shipping_last_name(),
            'address_1' => $order->get_shipping_address_1(),
            'address_2' => $order->get_shipping_address_2(),
            'city' => $order->get_shipping_city(),
            'state' => $order->get_shipping_state(),
            'postcode' => $order->get_shipping_postcode(),
            'country' => $order->get_shipping_country(),
        ],
        'line_items' => [],
    ];
    
    // Get line items
    foreach ($order->get_items() as $item_id => $item) {
        $product = $item->get_product();
        $order_data['line_items'][] = [
            'id' => $item_id,
            'product_id' => $item->get_product_id(),
            'variation_id' => $item->get_variation_id(),
            'name' => $item->get_name(),
            'quantity' => $item->get_quantity(),
            'subtotal' => $item->get_subtotal(),
            'total' => $item->get_total(),
            'price' => $item->get_total() / $item->get_quantity(),
        ];
    }
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'order' => $order_data,
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to fetch order: ' . $e->getMessage();
    error_log('[getOrder] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[getOrder] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

