<?php
/**
 * Plugin Name: Yardsale Orders API
 * Description: Custom WordPress REST API endpoint for fetching user orders with JWT authentication
 * Version: 1.0.0
 * Author: Yardsale Team
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Register custom REST API endpoint for user orders
 */
add_action('rest_api_init', function () {
    register_rest_route('yardsale/v1', '/my-orders', array(
        'methods' => 'GET',
        'callback' => 'yardsale_get_my_orders',
        'permission_callback' => 'yardsale_jwt_auth_check',
    ));
});

/**
 * JWT Authentication check
 * Validates JWT token and returns user ID
 */
function yardsale_jwt_auth_check($request) {
    // Get Authorization header
    $auth_header = $request->get_header('Authorization');
    
    if (!$auth_header) {
        return new WP_Error(
            'missing_authorization',
            'Authorization header is required',
            array('status' => 401)
        );
    }
    
    // Extract Bearer token
    if (!preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
        return new WP_Error(
            'invalid_authorization',
            'Invalid Authorization header format. Expected: Bearer {token}',
            array('status' => 401)
        );
    }
    
    $token = trim($matches[1]);
    
    if (empty($token)) {
        return new WP_Error(
            'empty_token',
            'JWT token is required',
            array('status' => 401)
        );
    }
    
    // Validate JWT token using JWT Authentication plugin
    // The plugin should be installed and activated
    if (!function_exists('jwt_auth_validate_token')) {
        // Try alternative JWT validation
        $user_id = yardsale_validate_jwt_token($token);
        
        if (!$user_id) {
            return new WP_Error(
                'invalid_token',
                'Invalid or expired JWT token',
                array('status' => 401)
            );
        }
        
        // Set current user
        wp_set_current_user($user_id);
        return true;
    }
    
    // Use JWT Authentication plugin's validation
    $user = jwt_auth_validate_token($token);
    
    if (is_wp_error($user)) {
        return $user;
    }
    
    // Set current user
    wp_set_current_user($user->ID);
    return true;
}

/**
 * Validate JWT token manually (fallback if JWT plugin function not available)
 */
function yardsale_validate_jwt_token($token) {
    // Decode JWT token
    $token_parts = explode('.', $token);
    
    if (count($token_parts) !== 3) {
        return false;
    }
    
    // Decode payload
    $payload = json_decode(base64_decode(strtr($token_parts[1], '-_', '+/')), true);
    
    if (!$payload || !isset($payload['data']['user']['id'])) {
        return false;
    }
    
    $user_id = $payload['data']['user']['id'];
    
    // Verify user exists
    $user = get_user_by('ID', $user_id);
    
    if (!$user) {
        return false;
    }
    
    // TODO: Add token expiration check if needed
    // You can check $payload['exp'] against current time
    
    return $user_id;
}

/**
 * Get orders for the authenticated user
 */
function yardsale_get_my_orders($request) {
    // Get current user (set by permission_callback)
    $user_id = get_current_user_id();
    
    if (!$user_id) {
        return new WP_Error(
            'not_authenticated',
            'User not authenticated',
            array('status' => 401)
        );
    }
    
    // Get user email for WooCommerce API
    $user = get_userdata($user_id);
    $user_email = $user->user_email;
    
    // Get query parameters
    $per_page = $request->get_param('per_page') ?: 100;
    $page = $request->get_param('page') ?: 1;
    $status = $request->get_param('status');
    
    // Build WooCommerce API request
    $wc_api_url = rest_url('wc/v3/orders');
    $params = array(
        'customer' => $user_id,
        'per_page' => $per_page,
        'page' => $page,
    );
    
    if ($status) {
        $params['status'] = $status;
    }
    
    $wc_api_url = add_query_arg($params, $wc_api_url);
    
    // Use WooCommerce REST API to fetch orders
    // This requires WooCommerce to be installed
    if (!class_exists('WooCommerce')) {
        return new WP_Error(
            'woocommerce_not_installed',
            'WooCommerce is not installed',
            array('status' => 500)
        );
    }
    
    // Get WooCommerce REST API credentials
    // You can use application passwords or consumer keys
    $consumer_key = defined('WC_CONSUMER_KEY') ? WC_CONSUMER_KEY : '';
    $consumer_secret = defined('WC_CONSUMER_SECRET') ? WC_CONSUMER_SECRET : '';
    
    if (empty($consumer_key) || empty($consumer_secret)) {
        // Fallback: Use internal WooCommerce API
        $orders = wc_get_orders(array(
            'customer_id' => $user_id,
            'limit' => $per_page,
            'paged' => $page,
            'status' => $status ? explode(',', $status) : 'any',
        ));
        
        // Format orders for response
        $formatted_orders = array();
        foreach ($orders as $order) {
            $formatted_orders[] = array(
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'date_created' => $order->get_date_created()->date('Y-m-d H:i:s'),
                'date_paid' => $order->get_date_paid() ? $order->get_date_paid()->date('Y-m-d H:i:s') : null,
                'total' => $order->get_total(),
                'currency' => $order->get_currency(),
                'payment_method' => $order->get_payment_method(),
                'payment_method_title' => $order->get_payment_method_title(),
                'transaction_id' => $order->get_transaction_id(),
                'billing' => array(
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'email' => $order->get_billing_email(),
                    'phone' => $order->get_billing_phone(),
                ),
                'line_items' => array_map(function($item) {
                    return array(
                        'id' => $item->get_id(),
                        'product_id' => $item->get_product_id(),
                        'name' => $item->get_name(),
                        'quantity' => $item->get_quantity(),
                        'total' => $item->get_total(),
                        'image' => array(
                            'src' => wp_get_attachment_image_url($item->get_product()->get_image_id(), 'thumbnail')
                        ),
                    );
                }, $order->get_items()),
            );
        }
        
        return array(
            'orders' => $formatted_orders,
            'count' => count($formatted_orders),
            'success' => true,
        );
    }
    
    // Use REST API with credentials
    $response = wp_remote_get($wc_api_url, array(
        'headers' => array(
            'Authorization' => 'Basic ' . base64_encode($consumer_key . ':' . $consumer_secret),
        ),
        'timeout' => 30,
    ));
    
    if (is_wp_error($response)) {
        return new WP_Error(
            'api_error',
            'Failed to fetch orders: ' . $response->get_error_message(),
            array('status' => 500)
        );
    }
    
    $body = wp_remote_retrieve_body($response);
    $orders = json_decode($body, true);
    
    if (!is_array($orders)) {
        return new WP_Error(
            'invalid_response',
            'Invalid response from WooCommerce API',
            array('status' => 500)
        );
    }
    
    return array(
        'orders' => $orders,
        'count' => count($orders),
        'success' => true,
    );
}
