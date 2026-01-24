<?php
// API for creating WooCommerce orders

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (
    !isset($input['billing']) ||
    !isset($input['billing']['email']) ||
    !isset($input['billing']['firstName']) ||
    !isset($input['billing']['lastName']) ||
    !isset($input['billing']['phone']) ||
    !isset($input['billing']['address1']) ||
    !isset($input['billing']['city']) ||
    !isset($input['line_items']) ||
    !is_array($input['line_items']) ||
    count($input['line_items']) === 0
) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: billing (email, firstName, lastName, phone, address1, city) and line_items']);
    exit();
}

// Load environment variables from .env file
$env_path = dirname(__DIR__, 2) . '/.env';
if (file_exists($env_path)) {
    $env_lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($env_lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value, '"\'');
        }
    }
}

$base_url = $_ENV['BASE_URL'] ?? 'http://localhost/yardsale_thailand';
$wp_api_url = $_ENV['WP_MEDIA_HOST'] ?? rtrim($base_url, '/') . '/wordpress';
$wp_api_url = rtrim($wp_api_url, '/') . '/wp-json/wc/v3/orders';

$auth = $_ENV['WP_BASIC_AUTH'] ?? 'cGFyYWRvbl9wb2twaW5nbWF1bmc6eDRkTCA4QUp1IHQzSHkgZzIyMyA5aTViIG9hTnk=';

if (empty($auth)) {
    http_response_code(500);
    echo json_encode(['error' => 'WP_BASIC_AUTH is not set in .env file']);
    exit();
}

// Load WordPress for customer creation
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wp-load.php'; // Fallback path
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found']);
    exit();
}
require_once($wp_load_path);

// Prepare order data
$billing = $input['billing'];
$line_items = $input['line_items'];

// Calculate totals
$total = 0;
$line_items_data = [];

foreach ($line_items as $item) {
    $product_id = isset($item['product_id']) ? intval($item['product_id']) : 0;
    $quantity = isset($item['quantity']) ? intval($item['quantity']) : 1;
    $price = isset($item['price']) ? floatval($item['price']) : 0;
    
    if ($product_id <= 0 || $quantity <= 0) {
        continue;
    }
    
    $line_total = $price * $quantity;
    $total += $line_total;
    
    $line_items_data[] = [
        'product_id' => $product_id,
        'quantity' => $quantity,
        'price' => $price,
    ];
}

if (count($line_items_data) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'No valid line items']);
    exit();
}

// Prepare order payload
$order_data = [
    'payment_method' => $input['payment_method'] ?? 'cod',
    'payment_method_title' => $input['payment_method_title'] ?? 'Cash on Delivery',
    'set_paid' => isset($input['set_paid']) ? (bool)$input['set_paid'] : false,
    'billing' => [
        'first_name' => $billing['firstName'] ?? '',
        'last_name' => $billing['lastName'] ?? '',
        'email' => $billing['email'] ?? '',
        'phone' => $billing['phone'] ?? '',
        'address_1' => $billing['address1'] ?? '',
        'address_2' => $billing['address2'] ?? '',
        'city' => $billing['city'] ?? '',
        'state' => $billing['state'] ?? '',
        'postcode' => $billing['postcode'] ?? '',
        'country' => $billing['country'] ?? 'TH',
    ],
    'shipping' => [
        'first_name' => $billing['firstName'] ?? '',
        'last_name' => $billing['lastName'] ?? '',
        'address_1' => $billing['address1'] ?? '',
        'address_2' => $billing['address2'] ?? '',
        'city' => $billing['city'] ?? '',
        'state' => $billing['state'] ?? '',
        'postcode' => $billing['postcode'] ?? '',
        'country' => $billing['country'] ?? 'TH',
    ],
    'line_items' => $line_items_data,
    'status' => $input['status'] ?? 'pending',
];

// Use customer_id from input if provided (logged-in user)
// Otherwise, try to find or create customer by email
$customer_id = null;
if (!empty($input['customer_id'])) {
    // Use provided customer_id (from logged-in user)
    $customer_id = intval($input['customer_id']);
    // Verify customer exists
    $customer = get_user_by('id', $customer_id);
    if (!$customer) {
        $customer_id = null; // Reset if customer doesn't exist
    }
}

// If no customer_id provided, try to find or create by email
if (!$customer_id && !empty($billing['email'])) {
    $customer = get_user_by('email', $billing['email']);
    if ($customer) {
        $customer_id = $customer->ID;
    } else {
        // Create new customer
        $username = sanitize_user($billing['email']);
        $password = wp_generate_password(12, false);
        
        $user_id = wp_create_user($username, $password, $billing['email']);
        if (!is_wp_error($user_id)) {
            $customer_id = $user_id;
            // Set user role
            $user = new WP_User($user_id);
            $user->set_role('customer');
            
            // Update user meta
            update_user_meta($user_id, 'first_name', $billing['firstName'] ?? '');
            update_user_meta($user_id, 'last_name', $billing['lastName'] ?? '');
            update_user_meta($user_id, 'billing_phone', $billing['phone'] ?? '');
            update_user_meta($user_id, 'billing_address_1', $billing['address1'] ?? '');
            update_user_meta($user_id, 'billing_city', $billing['city'] ?? '');
        }
    }
}

if ($customer_id) {
    $order_data['customer_id'] = $customer_id;
}

// Send cURL request to WooCommerce REST API
$ch = curl_init($wp_api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($order_data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Basic ' . $auth
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL Error: ' . $error]);
    exit();
}

$response_data = json_decode($response, true);

if ($http_code >= 200 && $http_code < 300) {
    // Reduce stock levels after order is created
    // WooCommerce reduces stock automatically when order status is 'processing', 'completed', or 'on-hold'
    // For 'pending' orders, we need to reduce stock manually
    $order_id = isset($response_data['id']) ? intval($response_data['id']) : null;
    
    if ($order_id) {
        $order = wc_get_order($order_id);
        if ($order) {
            // Check if stock should be reduced
            $order_status = $order->get_status();
            $stock_reduced = $order->get_data_store()->get_stock_reduced($order_id);
            
            // Reduce stock if not already reduced and order status allows it
            if (!$stock_reduced) {
                // For pending orders, reduce stock manually
                if ($order_status === 'pending') {
                    foreach ($order->get_items() as $item) {
                        if (!$item->is_type('line_item')) {
                            continue;
                        }
                        
                        $product = $item->get_product();
                        if (!$product || !$product->managing_stock()) {
                            continue;
                        }
                        
                        $qty = $item->get_quantity();
                        $new_stock = wc_update_product_stock($product, $qty, 'decrease');
                        
                        if (!is_wp_error($new_stock)) {
                            $item->add_meta_data('_reduced_stock', $qty, true);
                            $item->save();
                        }
                    }
                    
                    // Mark stock as reduced
                    $order->get_data_store()->set_stock_reduced($order_id, true);
                } else {
                    // For other statuses, use WooCommerce function
                    wc_reduce_stock_levels($order);
                }
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Order created successfully',
        'order' => $response_data
    ], JSON_UNESCAPED_UNICODE);
} else {
    http_response_code($http_code);
    echo json_encode([
        'error' => 'Failed to create order',
        'details' => $response_data,
        'status_code' => $http_code
    ], JSON_UNESCAPED_UNICODE);
}
?>

