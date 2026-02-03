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
    // Get Authorization header from multiple sources
    $auth_header = null;
    
    // Method 1: Try get_header() (standard WordPress REST API)
    $auth_header = $request->get_header('Authorization');
    
    // Method 2: Try get_header() with lowercase
    if (!$auth_header) {
        $auth_header = $request->get_header('authorization');
    }
    
    // Method 3: Try from $_SERVER (for some server configurations)
    if (!$auth_header) {
        $auth_header = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : null;
    }
    
    // Method 4: Try REDIRECT_HTTP_AUTHORIZATION (for some server configurations)
    if (!$auth_header) {
        $auth_header = isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : null;
    }
    
    // Method 5: Try from getallheaders() if available
    if (!$auth_header && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $auth_header = $headers['Authorization'];
        } elseif (isset($headers['authorization'])) {
            $auth_header = $headers['authorization'];
        }
    }
    
    // Debug: Log all headers for troubleshooting
    error_log('[yardsale_jwt_auth_check] Authorization header check:');
    error_log('[yardsale_jwt_auth_check] get_header(Authorization): ' . ($request->get_header('Authorization') ?: 'null'));
    error_log('[yardsale_jwt_auth_check] $_SERVER[HTTP_AUTHORIZATION]: ' . (isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : 'not set'));
    error_log('[yardsale_jwt_auth_check] Final auth_header: ' . ($auth_header ?: 'null'));
    
    if (!$auth_header) {
        return new WP_Error(
            'missing_authorization',
            'Authorization header is required. Please include "Authorization: Bearer {token}" in your request headers.',
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
    
    // Use internal WooCommerce API directly (no need for REST API credentials)
    // This is more secure and doesn't require consumer keys
    $orders = wc_get_orders(array(
        'customer_id' => $user_id,
        'limit' => $per_page,
        'paged' => $page,
        'status' => $status ? explode(',', $status) : 'any',
    ));
    
    // If wc_get_orders is not available, try REST API with Basic Auth
    if (empty($orders) || !function_exists('wc_get_orders')) {
        // Get WooCommerce REST API credentials from WordPress options or constants
        $consumer_key = defined('WC_CONSUMER_KEY') ? WC_CONSUMER_KEY : get_option('woocommerce_api_consumer_key', '');
        $consumer_secret = defined('WC_CONSUMER_SECRET') ? WC_CONSUMER_SECRET : get_option('woocommerce_api_consumer_secret', '');
        
        if (empty($consumer_key) || empty($consumer_secret)) {
            // Try to get from Application Password if available
            $app_password = get_user_meta($user_id, 'application_passwords', true);
            
            if (empty($app_password)) {
                // Last resort: Use internal WooCommerce functions
                global $wpdb;
                $orders_table = $wpdb->prefix . 'posts';
                $order_items_table = $wpdb->prefix . 'woocommerce_order_items';
                
                $query = $wpdb->prepare(
                    "SELECT * FROM {$orders_table} 
                    WHERE post_type = 'shop_order' 
                    AND post_author = %d 
                    ORDER BY post_date DESC 
                    LIMIT %d OFFSET %d",
                    $user_id,
                    $per_page,
                    ($page - 1) * $per_page
                );
                
                $order_posts = $wpdb->get_results($query);
                $orders = array();
                
                foreach ($order_posts as $order_post) {
                    $order = wc_get_order($order_post->ID);
                    if ($order) {
                        $orders[] = $order;
                    }
                }
            }
        }
    }
    
    if (empty($orders)) {
        // Return empty result instead of error
        return array(
            'orders' => array(),
            'count' => 0,
            'success' => true,
        );
    }
    
    // Format orders for response
    $formatted_orders = array();
    foreach ($orders as $order) {
        // Handle both WC_Order object
        if (is_object($order) && method_exists($order, 'get_id')) {
            $product_image_id = null;
            $line_items_data = array();
            
            foreach ($order->get_items() as $item) {
                $product = $item->get_product();
                $image_id = $product ? $product->get_image_id() : 0;
                
                $line_items_data[] = array(
                    'id' => $item->get_id(),
                    'product_id' => $item->get_product_id(),
                    'name' => $item->get_name(),
                    'quantity' => $item->get_quantity(),
                    'total' => $item->get_total(),
                    'image' => $image_id ? array(
                        'src' => wp_get_attachment_image_url($image_id, 'thumbnail')
                    ) : null,
                );
            }
            
            $formatted_orders[] = array(
                'id' => $order->get_id(),
                'number' => $order->get_order_number(),
                'status' => $order->get_status(),
                'date_created' => $order->get_date_created() ? $order->get_date_created()->date('Y-m-d H:i:s') : null,
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
                'line_items' => $line_items_data,
            );
        }
    }
    
    return array(
        'orders' => $formatted_orders,
        'count' => count($formatted_orders),
        'success' => true,
    );
}
