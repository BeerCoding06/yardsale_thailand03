<?php
// API for fetching WooCommerce customer billing data

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

if (!class_exists('WC_Customer')) {
    http_response_code(500);
    echo json_encode(['error' => 'WC_Customer class not found.']);
    exit();
}

try {
    $user = null;
    $customer = null;
    
    // Get user by ID or email
    if ($customer_id) {
        $user = get_user_by('id', $customer_id);
    } elseif ($customer_email) {
        $user = get_user_by('email', $customer_email);
    }
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit();
    }
    
    // Create WC_Customer instance
    $customer = new WC_Customer($user->ID);
    
    if (!$customer || !$customer->get_id()) {
        http_response_code(404);
        echo json_encode(['error' => 'Customer not found']);
        exit();
    }
    
    // Get billing data - use user meta as fallback
    $billing_email = $customer->get_billing_email();
    if (empty($billing_email)) {
        $billing_email = $customer->get_email();
    }
    if (empty($billing_email)) {
        $billing_email = $user->user_email;
    }
    
    $billing_first_name = $customer->get_billing_first_name();
    if (empty($billing_first_name)) {
        $billing_first_name = $customer->get_first_name();
    }
    if (empty($billing_first_name)) {
        $billing_first_name = get_user_meta($user->ID, 'first_name', true);
    }
    
    $billing_last_name = $customer->get_billing_last_name();
    if (empty($billing_last_name)) {
        $billing_last_name = $customer->get_last_name();
    }
    if (empty($billing_last_name)) {
        $billing_last_name = get_user_meta($user->ID, 'last_name', true);
    }
    
    $billing_data = [
        'email' => $billing_email ?: '',
        'first_name' => $billing_first_name ?: '',
        'last_name' => $billing_last_name ?: '',
        'phone' => $customer->get_billing_phone() ?: '',
        'address1' => $customer->get_billing_address_1() ?: '',
        'address2' => $customer->get_billing_address_2() ?: '',
        'city' => $customer->get_billing_city() ?: '',
        'state' => $customer->get_billing_state() ?: '',
        'postcode' => $customer->get_billing_postcode() ?: '',
        'country' => $customer->get_billing_country() ?: 'TH',
    ];
    
    // Also get user data
    $user_data = [
        'id' => $user->ID,
        'email' => $user->user_email,
        'username' => $user->user_login,
        'display_name' => $user->display_name,
    ];
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'customer' => $user_data,
        'billing' => $billing_data,
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to fetch customer data: ' . $e->getMessage();
    error_log('[getCustomerData] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[getCustomerData] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

