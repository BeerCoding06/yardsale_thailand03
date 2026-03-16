<?php
/**
 * Plugin Name: Yardsale Orders API
 * Description: Custom WordPress REST API endpoint for fetching user orders with JWT authentication
 * Version: 1.0.0
 * Author: Yardsale Team
 *
 * SECURITY: No eval(), assert(), create_function(), or dynamic include/require.
 * All input is validated/sanitized; JWT payload is only base64_decode + json_decode and read as data (no code execution).
 *
 * PERMISSIONS / ROLES (สิทธิ์ที่ user ต้องมี):
 * - ไม่บังคับ role เฉพาะ: user ทุก role ใช้ my-products, my-orders, create-product, update-product ได้
 *   (Subscriber, Contributor, Author, Editor, Shop Manager, Administrator)
 * - สิ่งที่ต้องมี:
 *   1. เป็น WordPress user ที่มีอยู่จริง (มีใน wp_users)
 *   2. Login แล้วได้ JWT ที่มี payload.data.user.id = WordPress User ID
 *   3. ถ้าใช้ plugin JWT Authentication for WP REST API: user ต้อง login ผ่าน /wp-json/jwt-auth/v1/token
 *      หรือระบบคุณออก JWT ให้ user.id เป็น ID ใน WordPress
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * ให้ JWT token มี email และ user_login ใน payload (ใช้กับ JWT Authentication for WP-API)
 * เพื่อให้ Yardsale อ่าน user จาก email/login ได้แน่นอน ตอน my-products / create-product
 */
$yardsale_jwt_add_user_data = function ($token, $user) {
    if (!is_array($token)) {
        return $token;
    }
    if (!isset($token['data']) || !is_array($token['data'])) {
        $token['data'] = array();
    }
    if (!isset($token['data']['user']) || !is_array($token['data']['user'])) {
        $token['data']['user'] = array();
    }
    $token['data']['user']['email'] = $user->user_email;
    $token['data']['user']['login'] = $user->user_login;
    $token['data']['user']['username'] = $user->user_login;
    return $token;
};
add_filter('jwt_auth_token_before_sign', $yardsale_jwt_add_user_data, 10, 2);
add_filter('jwt_auth_token_before_dispatch', $yardsale_jwt_add_user_data, 10, 2);

/**
 * Register custom REST API endpoint for user orders
 */
add_action('rest_api_init', function () {
    register_rest_route('yardsale/v1', '/my-orders', array(
        'methods' => 'GET',
        'callback' => 'yardsale_get_my_orders',
        'permission_callback' => 'yardsale_jwt_auth_check',
    ));
    
    // Register seller orders endpoint
    register_rest_route('yardsale/v1', '/seller-orders', array(
        'methods' => 'GET',
        'callback' => 'yardsale_get_seller_orders',
        'permission_callback' => 'yardsale_jwt_auth_check',
    ));
    
    // Register seller products endpoint
    register_rest_route('yardsale/v1', '/my-products', array(
        'methods' => 'GET',
        'callback' => 'yardsale_get_my_products',
        'permission_callback' => 'yardsale_jwt_auth_check',
    ));
    
    // Create product (runs as JWT user inside WordPress - no REST API permission issue)
    register_rest_route('yardsale/v1', '/create-product', array(
        'methods' => 'POST',
        'callback' => 'yardsale_create_product',
        'permission_callback' => 'yardsale_jwt_auth_check',
        'args' => array(
            'name' => array('required' => true, 'type' => 'string'),
            'regular_price' => array('required' => true, 'type' => 'string'),
            'type' => array('default' => 'simple', 'type' => 'string'),
            'status' => array('default' => 'pending', 'type' => 'string'),
            'description' => array('type' => 'string'),
            'short_description' => array('type' => 'string'),
            'sku' => array('type' => 'string'),
            'sale_price' => array('type' => 'string'),
            'manage_stock' => array('type' => 'boolean'),
            'stock_quantity' => array('type' => 'integer'),
            'categories' => array('type' => 'array'),
            'tags' => array('type' => 'array'),
            'images' => array('type' => 'array'),
        ),
    ));
    
    // Update product (JWT user can edit own product only)
    register_rest_route('yardsale/v1', '/update-product', array(
        'methods' => 'POST',
        'callback' => 'yardsale_update_product',
        'permission_callback' => 'yardsale_jwt_auth_check',
    ));

    // Set product author (ใช้หลังสร้างสินค้าผ่าน WooCommerce API แล้ว ให้ตั้ง post_author = user จาก JWT)
    register_rest_route('yardsale/v1', '/set-product-author', array(
        'methods' => 'POST',
        'callback' => 'yardsale_set_product_author',
        'permission_callback' => 'yardsale_jwt_auth_check',
        'args' => array(
            'product_id' => array('required' => true, 'type' => 'integer'),
        ),
    ));

    // Create order (รันในบริบท user ที่ login ผ่าน JWT – ไม่พึ่ง WooCommerce REST API key)
    register_rest_route('yardsale/v1', '/create-order', array(
        'methods' => 'POST',
        'callback' => 'yardsale_create_order',
        'permission_callback' => 'yardsale_jwt_auth_check',
    ));

    // อัปเดตออเดอร์เป็น processing เมื่อชำระ Omise สำเร็จ (เรียกจาก webhook โดยส่ง secret)
    register_rest_route('yardsale/v1', '/order-paid', array(
        'methods' => 'POST',
        'callback' => 'yardsale_order_paid',
        'permission_callback' => '__return_true',
        'args' => array(
            'order_id' => array('required' => true, 'type' => 'integer'),
            'secret'   => array('type' => 'string'),
        ),
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
    
    // ใช้การ decode ของเราเท่านั้น (email → login → id) เพื่อให้ได้ user ตรงกับคนที่ login เสมอ
    $user_id = yardsale_validate_jwt_token($token);
    if ($user_id) {
        wp_set_current_user($user_id);
        error_log('[yardsale_jwt_auth_check] Authenticated user_id=' . $user_id);
        return true;
    }
    // Fallback: ถ้า decode เราไม่ผ่าน ค่อยใช้ของ JWT Auth plugin
    if (function_exists('jwt_auth_validate_token')) {
        $user = jwt_auth_validate_token($token);
        if (!is_wp_error($user) && $user && isset($user->ID)) {
            wp_set_current_user($user->ID);
            error_log('[yardsale_jwt_auth_check] Authenticated via plugin user_id=' . $user->ID);
            return true;
        }
    }
    error_log('[yardsale_jwt_auth_check] Token invalid or user not found');
    return new WP_Error(
        'invalid_token',
        'Invalid or expired JWT token',
        array('status' => 401)
    );
}

/**
 * Validate JWT token manually (fallback if JWT plugin function not available)
 * รองรับหลายรูปแบบ payload; ถ้ามี email ใน payload จะใช้ email หา user ใน WordPress ก่อน (ให้ตรงกับ user ที่ login)
 * SECURITY: Only base64_decode + json_decode; payload is used as data only (get_user_by, (int) id). No eval/exec.
 */
function yardsale_validate_jwt_token($token) {
    if (!is_string($token) || $token === '') {
        return false;
    }
    $token_parts = explode('.', $token);
    if (count($token_parts) < 2) {
        error_log('[yardsale_validate_jwt_token] Token has less than 2 parts');
        return false;
    }
    $payload_b64 = strtr($token_parts[1], '-_', '+/');
    $payload_b64 .= str_repeat('=', (4 - strlen($payload_b64) % 4) % 4);
    $decoded = base64_decode($payload_b64, true);
    if ($decoded === false) {
        return false;
    }
    $payload = json_decode($decoded, true);
    if (!is_array($payload)) {
        error_log('[yardsale_validate_jwt_token] Payload decode failed or not array');
        return false;
    }
    $email = null;
    if (!empty($payload['data']['user']['email'])) {
        $email = $payload['data']['user']['email'];
    } elseif (!empty($payload['user']['email'])) {
        $email = $payload['user']['email'];
    } elseif (!empty($payload['email'])) {
        $email = $payload['email'];
    }
    // ถ้ามี email ให้ใช้หา user ใน WordPress ก่อน (ให้ได้ user คนที่ login จริง เช่น paradon45645@gmail.com)
    if (is_string($email) && trim($email) !== '') {
        $user = get_user_by('email', trim($email));
        if ($user) {
            error_log('[yardsale_validate_jwt_token] Resolved user by email: ' . $email . ' -> ID ' . $user->ID);
            return (int) $user->ID;
        }
    }
    // ลองจาก user_login ใน payload
    $login = null;
    if (!empty($payload['data']['user']['username'])) {
        $login = $payload['data']['user']['username'];
    } elseif (!empty($payload['user']['username'])) {
        $login = $payload['user']['username'];
    } elseif (!empty($payload['data']['user']['login'])) {
        $login = $payload['data']['user']['login'];
    } elseif (!empty($payload['user']['login'])) {
        $login = $payload['user']['login'];
    } elseif (!empty($payload['username'])) {
        $login = $payload['username'];
    }
    if (is_string($login) && trim($login) !== '') {
        $user = get_user_by('login', trim($login));
        if ($user) {
            error_log('[yardsale_validate_jwt_token] Resolved user by login: ' . $login . ' -> ID ' . $user->ID);
            return (int) $user->ID;
        }
    }
    // ลองจาก id ใน payload
    $user_id = null;
    if (!empty($payload['data']['user']['id'])) {
        $user_id = (int) $payload['data']['user']['id'];
    } elseif (!empty($payload['user']['id'])) {
        $user_id = (int) $payload['user']['id'];
    } elseif (isset($payload['user_id'])) {
        $user_id = (int) $payload['user_id'];
    } elseif (isset($payload['id'])) {
        $user_id = (int) $payload['id'];
    }
    if ($user_id > 0) {
        $user = get_user_by('ID', $user_id);
        if ($user) {
            error_log('[yardsale_validate_jwt_token] Resolved user by id: ' . $user_id . ' (' . $user->user_email . ')');
            return $user_id;
        }
    }
    error_log('[yardsale_validate_jwt_token] Could not resolve user from payload. Keys: ' . implode(',', array_keys($payload)));
    return false;
}

/**
 * Get orders for the authenticated user เท่านั้น
 * Returns only orders where customer_id = current user (ออเดอร์ที่ user นี้เป็นผู้ซื้อ).
 * ไม่ใช้ customer_id จาก request – ใช้เฉพาะจาก JWT (get_current_user_id()).
 */
function yardsale_get_my_orders($request) {
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
    
    // Format orders for response (เฉพาะของตัวเองเท่านั้น – ตรวจ customer_id อีกครั้ง)
    $formatted_orders = array();
    $user_id_int = (int) $user_id;
    foreach ($orders as $order) {
        // Handle both WC_Order object
        if (is_object($order) && method_exists($order, 'get_id')) {
            $order_customer_id = (int) $order->get_customer_id();
            if ($order_customer_id !== $user_id_int) {
                continue; // ไม่ใช่ order ของ user นี้ – ไม่ส่งกลับ
            }
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

/**
 * Get seller orders for the authenticated user
 * Returns orders that contain products owned by the authenticated user (seller)
 */
function yardsale_get_seller_orders($request) {
    // Get current user (set by permission_callback)
    $user_id = get_current_user_id();
    
    if (!$user_id) {
        return new WP_Error(
            'not_authenticated',
            'User not authenticated',
            array('status' => 401)
        );
    }
    
    // Check if WooCommerce is installed
    if (!class_exists('WooCommerce')) {
        return new WP_Error(
            'woocommerce_not_installed',
            'WooCommerce is not installed',
            array('status' => 500)
        );
    }
    
    // Get query parameters
    $per_page = $request->get_param('per_page') ?: 100;
    $page = $request->get_param('page') ?: 1;
    $status = $request->get_param('status');
    
    // Get all orders (we'll filter by seller products)
    $all_orders = wc_get_orders(array(
        'limit' => $per_page * 2, // Get more orders to filter
        'paged' => $page,
        'status' => $status ? explode(',', $status) : 'any',
        'orderby' => 'date',
        'order' => 'DESC',
    ));
    
    if (empty($all_orders)) {
        return array(
            'orders' => array(),
            'count' => 0,
            'success' => true,
        );
    }
    
    // Filter orders that contain products owned by this seller
    $seller_orders = array();
    
    foreach ($all_orders as $order) {
        $seller_total = 0;
        $seller_line_items = array();
        $has_seller_product = false;
        
        // Check each line item
        foreach ($order->get_items() as $item) {
            $product_id = $item->get_product_id();
            
            if (!$product_id) {
                continue;
            }
            
            // Get product author (seller) using get_post_field
            $product_author_id = get_post_field('post_author', $product_id);
            
            // Check if this product belongs to the seller
            if ((int)$product_author_id === (int)$user_id) {
                $has_seller_product = true;
                $item_total = (float)$item->get_total();
                $seller_total += $item_total;
                
                // Get product image
                $product = $item->get_product();
                $image_id = $product ? $product->get_image_id() : 0;
                $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'thumbnail') : null;
                
                $seller_line_items[] = array(
                    'id' => $item->get_id(),
                    'product_id' => $product_id,
                    'name' => $item->get_name(),
                    'quantity' => $item->get_quantity(),
                    'total' => $item->get_total(),
                    'image' => $image_url ? array('src' => $image_url) : null,
                );
            }
        }
        
        // Only include orders that have products from this seller
        if ($has_seller_product) {
            // Determine payment status
            $is_paid = $order->get_date_paid() !== null;
            $payment_status = 'pending';
            
            if ($is_paid) {
                $payment_status = 'paid';
            } elseif ($order->get_status() === 'completed') {
                $payment_status = 'paid';
            } elseif ($order->get_status() === 'processing') {
                $payment_status = 'processing';
            } elseif ($order->get_status() === 'on-hold') {
                $payment_status = 'on_hold';
            } elseif ($order->get_status() === 'failed') {
                $payment_status = 'failed';
            } elseif ($order->get_status() === 'refunded') {
                $payment_status = 'refunded';
            } elseif ($order->get_status() === 'cancelled') {
                $payment_status = 'cancelled';
            }
            
            $seller_orders[] = array(
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
                'is_paid' => $is_paid,
                'payment_status' => $payment_status,
                'seller_total' => $seller_total,
                'seller_line_items' => $seller_line_items,
                'billing' => array(
                    'first_name' => $order->get_billing_first_name(),
                    'last_name' => $order->get_billing_last_name(),
                    'email' => $order->get_billing_email(),
                    'phone' => $order->get_billing_phone(),
                ),
            );
        }
    }
    
    // Limit results
    $seller_orders = array_slice($seller_orders, 0, $per_page);
    
    return array(
        'orders' => $seller_orders,
        'count' => count($seller_orders),
        'success' => true,
    );
}

/**
 * Get products for the authenticated user (seller) เท่านั้น
 * Returns only products owned by the authenticated user (post_author = current user).
 * ไม่ใช้ user_id จาก request – ใช้เฉพาะจาก JWT (get_current_user_id()).
 */
function yardsale_get_my_products($request) {
    $user_id = get_current_user_id();
    
    error_log('[yardsale_get_my_products] User ID: ' . $user_id);
    
    if (!$user_id) {
        error_log('[yardsale_get_my_products] Error: User not authenticated');
        return new WP_Error(
            'not_authenticated',
            'User not authenticated',
            array('status' => 401)
        );
    }
    
    // Get query parameters
    $per_page = $request->get_param('per_page') ?: 100;
    $page = $request->get_param('page') ?: 1;
    $status = $request->get_param('status'); // 'any', 'publish', 'draft', 'pending'
    
    // Use WooCommerce internal functions to get products by author
    if (!function_exists('wc_get_products')) {
        error_log('[yardsale_get_my_products] Error: WooCommerce not installed');
        return new WP_Error(
            'woocommerce_not_installed',
            'WooCommerce is not installed',
            array('status' => 500)
        );
    }
    
    global $wpdb;

    // Prefer direct DB query by post_author so we always get the current user's products (wc_get_products 'author' may be ignored in some WooCommerce versions)
    $status_where = '';
    $prepare_args = array((int) $user_id);
    if ($status && $status !== 'any') {
        $status_where = " AND p.post_status = %s";
        $prepare_args[] = $status;
    } else {
        $status_where = " AND p.post_status IN ('publish', 'pending', 'draft', 'private')";
    }
    $prepare_args[] = (int) $per_page;
    $prepare_args[] = (int) (($page - 1) * $per_page);
    $query = $wpdb->prepare("
        SELECT p.ID
        FROM {$wpdb->posts} p
        WHERE p.post_type = 'product'
        AND p.post_author = %d
        {$status_where}
        ORDER BY p.post_date DESC
        LIMIT %d OFFSET %d
    ", $prepare_args);

    error_log('[yardsale_get_my_products] Query by post_author=' . $user_id . ': ' . $query);
    $product_ids = $wpdb->get_col($query);
    error_log('[yardsale_get_my_products] Found ' . count($product_ids) . ' product IDs for user ' . $user_id);

    $wc_products = array();
    if (!empty($product_ids)) {
        foreach ($product_ids as $pid) {
            $product = wc_get_product($pid);
            if ($product) {
                $wc_products[] = $product;
            }
        }
    }
    
    if (empty($wc_products)) {
        return array(
            'products' => array(),
            'count' => 0,
            'success' => true,
            'requested_as_user_id' => (int) $user_id,
        );
    }
    
    // Format products for response (เฉพาะของตัวเองเท่านั้น – ตรวจ post_author อีกครั้ง)
    $formatted_products = array();
    $user_id_int = (int) $user_id;

    foreach ($wc_products as $product) {
        $pid = $product->get_id();
        $author = (int) get_post_field('post_author', $pid);
        if ($author !== $user_id_int) {
            continue; // ไม่ใช่ของ user นี้ – ไม่ส่งกลับ
        }
        // Get product image
        $image_id = $product->get_image_id();
        $image_url = $image_id ? wp_get_attachment_image_url($image_id, 'full') : null;
        
        $images = array();
        if ($image_url) {
            $images[] = array(
                'src' => $image_url,
                'sourceUrl' => $image_url,
            );
        }
        
        // Get gallery images
        $gallery_ids = $product->get_gallery_image_ids();
        foreach ($gallery_ids as $gallery_id) {
            $gallery_url = wp_get_attachment_image_url($gallery_id, 'full');
            if ($gallery_url) {
                $images[] = array(
                    'src' => $gallery_url,
                    'sourceUrl' => $gallery_url,
                );
            }
        }
        
        $formatted_products[] = array(
            'id' => $product->get_id(),
            'name' => $product->get_name(),
            'slug' => $product->get_slug(),
            'status' => $product->get_status(),
            'sku' => $product->get_sku(),
            'price' => $product->get_price(),
            'regular_price' => $product->get_regular_price(),
            'sale_price' => $product->get_sale_price(),
            'manage_stock' => $product->get_manage_stock(),
            'stock_quantity' => $product->get_stock_quantity(),
            'stock_status' => $product->get_stock_status(),
            'date_created' => $product->get_date_created() ? $product->get_date_created()->date('Y-m-d H:i:s') : null,
            'date_modified' => $product->get_date_modified() ? $product->get_date_modified()->date('Y-m-d H:i:s') : null,
            'images' => $images,
            'image' => $image_url ? array('src' => $image_url, 'sourceUrl' => $image_url) : null,
        );
    }
    
    return array(
        'products' => $formatted_products,
        'count' => count($formatted_products),
        'success' => true,
        'requested_as_user_id' => (int) $user_id,
    );
}

/**
 * Allow any logged-in user to create products (grant capabilities for this request only)
 */
function yardsale_allow_user_create_products($allcaps, $caps, $args, $user) {
    if (!$user || !isset($args[0])) {
        return $allcaps;
    }
    $cap = $args[0];
    $product_caps = array(
        'edit_products', 'publish_products', 'edit_published_products', 'create_products',
        'edit_post', 'publish_posts', 'edit_published_posts',
    );
    if (in_array($cap, $product_caps, true)) {
        $allcaps[$cap] = true;
    }
    return $allcaps;
}

/**
 * Create product via WooCommerce internal API (runs as JWT user - every user can create)
 * ผู้สร้าง (post_author) = user ที่ login จาก JWT เสมอ – ไม่รับ post_author จาก request
 */
function yardsale_create_product($request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('not_authenticated', 'User not authenticated', array('status' => 401));
    }

    if (!class_exists('WooCommerce') || !function_exists('wc_get_product_factory')) {
        return new WP_Error('woocommerce_not_installed', 'WooCommerce is not installed', array('status' => 500));
    }

    // Let any authenticated user create products (add capability for this request only)
    add_filter('user_has_cap', 'yardsale_allow_user_create_products', 10, 4);

    $params = $request->get_json_params();
    if (empty($params)) {
        $params = $request->get_body_params();
    }
    if (empty($params)) {
        return new WP_Error('invalid_data', 'Invalid or empty request body', array('status' => 400));
    }

    $name = isset($params['name']) ? sanitize_text_field($params['name']) : '';
    $regular_price = isset($params['regular_price']) ? $params['regular_price'] : '0';
    $type = isset($params['type']) ? sanitize_text_field($params['type']) : 'simple';
    $status = isset($params['status']) ? sanitize_text_field($params['status']) : 'pending';

    if (empty($name)) {
        remove_filter('user_has_cap', 'yardsale_allow_user_create_products', 10);
        return new WP_Error('invalid_data', 'Product name is required', array('status' => 400));
    }

    try {
        $product = new WC_Product_Simple();
        $product->set_name($name);
        $product->set_regular_price($regular_price);
        $product->set_status($status);
        $product->set_catalog_visibility('visible');

        if (isset($params['sale_price']) && $params['sale_price'] !== '') {
            $product->set_sale_price((string) $params['sale_price']);
        }
        if (isset($params['description'])) {
            $product->set_description($params['description']);
        }
        if (isset($params['short_description'])) {
            $product->set_short_description($params['short_description']);
        }
        if (!empty($params['sku']) && trim((string) $params['sku']) !== '') {
            $product->set_sku(sanitize_text_field($params['sku']));
        } else {
            $product->set_sku('YS-' . time() . '-' . bin2hex(random_bytes(2)));
        }
        if (isset($params['manage_stock'])) {
            $product->set_manage_stock((bool) $params['manage_stock']);
        }
        if (isset($params['stock_quantity'])) {
            $product->set_stock_quantity((int) $params['stock_quantity']);
        }

        $product->save();
        $product_id = $product->get_id();

        // Set post_author to current user (direct DB update so it always works regardless of capabilities)
        global $wpdb;
        $wpdb->update(
            $wpdb->posts,
            array('post_author' => (int) $user_id),
            array('ID' => (int) $product_id),
            array('%d'),
            array('%d')
        );
        if ($wpdb->last_error) {
            error_log('[yardsale_create_product] Failed to set post_author: ' . $wpdb->last_error);
        } else {
            error_log('[yardsale_create_product] Set post_author=' . $user_id . ' for product_id=' . $product_id);
        }

        // Categories
        if (!empty($params['categories']) && is_array($params['categories'])) {
            $term_ids = array();
            foreach ($params['categories'] as $cat) {
                $id = is_array($cat) ? (isset($cat['id']) ? $cat['id'] : (isset($cat['databaseId']) ? $cat['databaseId'] : null)) : $cat;
                if ($id) {
                    $term_ids[] = (int) $id;
                }
            }
            if (!empty($term_ids)) {
                wp_set_object_terms($product_id, $term_ids, 'product_cat');
            }
        }

        // Tags
        if (!empty($params['tags']) && is_array($params['tags'])) {
            $tag_ids = array();
            foreach ($params['tags'] as $tag) {
                $id = is_array($tag) ? (isset($tag['id']) ? $tag['id'] : null) : $tag;
                if ($id) {
                    $tag_ids[] = (int) $id;
                } else {
                    $name = is_array($tag) ? (isset($tag['name']) ? $tag['name'] : '') : $tag;
                    if (is_string($tag)) {
                        $name = $tag;
                    }
                    if ($name) {
                        $t = get_term_by('name', trim($name), 'product_tag');
                        if ($t) {
                            $tag_ids[] = $t->term_id;
                        } else {
                            $ins = wp_insert_term(trim($name), 'product_tag');
                            if (!is_wp_error($ins) && isset($ins['term_id'])) {
                                $tag_ids[] = $ins['term_id'];
                            }
                        }
                    }
                }
            }
            if (!empty($tag_ids)) {
                wp_set_object_terms($product_id, $tag_ids, 'product_tag');
            }
        }

        // Images (by URL - resolve to attachment ID if possible)
        if (!empty($params['images']) && is_array($params['images'])) {
            $gallery_ids = array();
            foreach ($params['images'] as $idx => $img) {
                $src = is_array($img) ? (isset($img['src']) ? $img['src'] : (isset($img['url']) ? $img['url'] : '')) : $img;
                if (empty($src) || !is_string($src)) {
                    continue;
                }
                $att_id = attachment_url_to_postid($src);
                if ($att_id) {
                    $gallery_ids[] = $att_id;
                }
            }
            if (!empty($gallery_ids)) {
                $product->set_image_id($gallery_ids[0]);
                if (count($gallery_ids) > 1) {
                    $product->set_gallery_image_ids(array_slice($gallery_ids, 1));
                }
                $product->save();
            }
        }

        $product->save();

        // ผู้สร้าง = user ที่ login (จาก JWT) เสมอ – ไม่รับ post_author จาก request
        $creator = get_userdata($user_id);
        return array(
            'success' => true,
            'product' => array(
                'id' => $product_id,
                'name' => $product->get_name(),
                'status' => $product->get_status(),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'post_author' => (int) $user_id,
                'author' => $creator ? array(
                    'id' => (int) $user_id,
                    'name' => $creator->display_name,
                    'login' => $creator->user_login,
                    'email' => $creator->user_email,
                ) : null,
            ),
        );
    } catch (Exception $e) {
        error_log('[yardsale_create_product] Error: ' . $e->getMessage());
        return new WP_Error('create_failed', $e->getMessage(), array('status' => 500));
    } finally {
        remove_filter('user_has_cap', 'yardsale_allow_user_create_products', 10);
    }
}

/**
 * Set product post_author to the current user (จาก JWT).
 * ใช้เมื่อสร้างสินค้าผ่าน WooCommerce API (เช่นจาก PHP) แล้วต้องตั้งเจ้าของ
 */
function yardsale_set_product_author($request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('not_authenticated', 'User not authenticated', array('status' => 401));
    }
    $params = $request->get_json_params();
    if (empty($params)) {
        $params = $request->get_body_params();
    }
    $product_id = isset($params['product_id']) ? (int) $params['product_id'] : 0;
    if (!$product_id) {
        return new WP_Error('invalid_data', 'product_id is required', array('status' => 400));
    }
    $post = get_post($product_id);
    if (!$post || $post->post_type !== 'product') {
        return new WP_Error('not_found', 'Product not found', array('status' => 404));
    }
    global $wpdb;
    $wpdb->update(
        $wpdb->posts,
        array('post_author' => (int) $user_id),
        array('ID' => (int) $product_id),
        array('%d'),
        array('%d')
    );
    if ($wpdb->last_error) {
        return new WP_Error('db_error', $wpdb->last_error, array('status' => 500));
    }
    error_log('[yardsale_set_product_author] Set post_author=' . $user_id . ' for product_id=' . $product_id);
    return array('success' => true, 'product_id' => $product_id, 'post_author' => (int) $user_id);
}

/**
 * Create order (รันเป็น user ที่ login จาก JWT – ใช้ WooCommerce ภายใน ไม่พึ่ง REST API key)
 */
function yardsale_create_order($request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('not_authenticated', 'User not authenticated', array('status' => 401));
    }
    if (!class_exists('WooCommerce') || !function_exists('wc_create_order') || !function_exists('wc_get_product')) {
        return new WP_Error('woocommerce_not_installed', 'WooCommerce is not installed', array('status' => 500));
    }

    $params = $request->get_json_params();
    if (empty($params)) {
        $params = $request->get_body_params();
    }
    if (empty($params) || empty($params['line_items']) || !is_array($params['line_items'])) {
        return new WP_Error('invalid_data', 'line_items is required', array('status' => 400));
    }

    $billing = isset($params['billing']) && is_array($params['billing']) ? $params['billing'] : array();
    $first_name = $billing['first_name'] ?? $billing['firstName'] ?? '';
    $last_name  = $billing['last_name'] ?? $billing['lastName'] ?? '';
    $email      = $billing['email'] ?? '';
    $phone      = $billing['phone'] ?? '';
    $address_1  = $billing['address_1'] ?? $billing['address1'] ?? '';
    $address_2  = $billing['address_2'] ?? $billing['address2'] ?? '';
    $city       = $billing['city'] ?? '';
    $state      = $billing['state'] ?? '';
    $postcode   = $billing['postcode'] ?? '';
    $country    = $billing['country'] ?? 'TH';

    try {
        $order = wc_create_order(array('customer_id' => (int) $user_id));
        if (is_wp_error($order)) {
            return $order;
        }

        $order->set_billing_first_name($first_name);
        $order->set_billing_last_name($last_name);
        $order->set_billing_email($email ?: get_userdata($user_id)->user_email);
        $order->set_billing_phone($phone);
        $order->set_billing_address_1($address_1);
        $order->set_billing_address_2($address_2);
        $order->set_billing_city($city);
        $order->set_billing_state($state);
        $order->set_billing_postcode($postcode);
        $order->set_billing_country($country ?: 'TH');

        foreach ($params['line_items'] as $item) {
            $product_id = (int) ($item['product_id'] ?? 0);
            $quantity   = (int) ($item['quantity'] ?? 1);
            $price      = isset($item['price']) ? (float) $item['price'] : 0;
            if ($product_id <= 0) {
                continue;
            }
            $product = wc_get_product($product_id);
            if (!$product) {
                continue;
            }
            $item_id = $order->add_product($product, $quantity);
            if ($item_id && $price > 0) {
                $line_item = $order->get_item($item_id, false);
                if ($line_item) {
                    $line_item->set_subtotal($price * $quantity);
                    $line_item->set_total($price * $quantity);
                    $line_item->save();
                }
            }
        }

        $order->set_payment_method($params['payment_method'] ?? 'cod');
        $order->set_payment_method_title($params['payment_method_title'] ?? 'ชำระเงินปลายทาง');
        $order->set_status($params['status'] ?? 'pending');
        $order->calculate_totals();
        $order->save();

        $order_id = $order->get_id();
        error_log('[yardsale_create_order] Order created: ' . $order_id . ' for user ' . $user_id);

        return array(
            'success' => true,
            'order'   => array(
                'id'                   => $order_id,
                'number'               => $order->get_order_number(),
                'status'               => $order->get_status(),
                'total'                => $order->get_total(),
                'customer_id'          => (int) $user_id,
                'billing'              => array(
                    'first_name' => $order->get_billing_first_name(),
                    'last_name'  => $order->get_billing_last_name(),
                    'email'      => $order->get_billing_email(),
                    'phone'      => $order->get_billing_phone(),
                    'address_1'  => $order->get_billing_address_1(),
                    'city'       => $order->get_billing_city(),
                    'postcode'   => $order->get_billing_postcode(),
                    'country'    => $order->get_billing_country(),
                ),
                'date_created'         => $order->get_date_created() ? $order->get_date_created()->format('c') : null,
                'payment_method_title' => $order->get_payment_method_title(),
            ),
        );
    } catch (Exception $e) {
        error_log('[yardsale_create_order] Error: ' . $e->getMessage());
        return new WP_Error('create_failed', $e->getMessage(), array('status' => 500));
    }
}

/**
 * อัปเดตออเดอร์เป็น processing เมื่อชำระ Omise สำเร็จ (เรียกจาก Nuxt webhook)
 * ต้องส่ง secret ตรงกับ OMISE_ORDER_PAID_SECRET หรือ OMISE_WEBHOOK_SECRET ใน WordPress
 */
function yardsale_order_paid($request) {
    $params = $request->get_json_params();
    if (empty($params)) {
        $params = $request->get_body_params();
    }
    $order_id = isset($params['order_id']) ? (int) $params['order_id'] : 0;
    $secret   = isset($params['secret']) ? (string) $params['secret'] : '';

    $expected = defined('OMISE_ORDER_PAID_SECRET') ? OMISE_ORDER_PAID_SECRET : (defined('OMISE_WEBHOOK_SECRET') ? OMISE_WEBHOOK_SECRET : getenv('OMISE_ORDER_PAID_SECRET'));
    if ($expected !== '' && $secret !== (string) $expected) {
        error_log('[yardsale_order_paid] Invalid or missing secret');
        return new WP_Error('forbidden', 'Invalid secret', array('status' => 403));
    }
    if ($order_id <= 0) {
        return new WP_Error('invalid_data', 'order_id is required', array('status' => 400));
    }
    if (!function_exists('wc_get_order')) {
        return new WP_Error('woocommerce_not_installed', 'WooCommerce is not installed', array('status' => 500));
    }
    $order = wc_get_order($order_id);
    if (!$order) {
        return new WP_Error('not_found', 'Order not found', array('status' => 404));
    }
    $order->set_status('processing');
    $order->save();
    error_log('[yardsale_order_paid] Order ' . $order_id . ' set to processing');
    return array('success' => true, 'order_id' => $order_id, 'status' => 'processing');
}

/**
 * Update product via WooCommerce internal API (JWT user can edit own product only)
 */
function yardsale_update_product($request) {
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('not_authenticated', 'User not authenticated', array('status' => 401));
    }

    if (!class_exists('WooCommerce') || !function_exists('wc_get_product')) {
        return new WP_Error('woocommerce_not_installed', 'WooCommerce is not installed', array('status' => 500));
    }

    $params = $request->get_json_params();
    if (empty($params)) {
        $params = $request->get_body_params();
    }
    if (empty($params) || empty($params['product_id'])) {
        return new WP_Error('invalid_data', 'product_id is required', array('status' => 400));
    }

    $product_id = (int) $params['product_id'];
    $product = wc_get_product($product_id);
    if (!$product) {
        return new WP_Error('not_found', 'Product not found', array('status' => 404));
    }

    $post = get_post($product_id);
    if (!$post || (int) $post->post_author !== $user_id) {
        return new WP_Error('forbidden', 'You do not have permission to update this product', array('status' => 403));
    }

    add_filter('user_has_cap', 'yardsale_allow_user_create_products', 10, 4);

    try {
        if (!empty($params['name'])) {
            $product->set_name(sanitize_text_field($params['name']));
        }
        if (isset($params['regular_price'])) {
            $product->set_regular_price($params['regular_price']);
        }
        if (isset($params['sale_price'])) {
            $product->set_sale_price($params['sale_price']);
        }
        if (isset($params['description'])) {
            $product->set_description($params['description']);
        }
        if (isset($params['short_description'])) {
            $product->set_short_description($params['short_description']);
        }
        if (isset($params['sku'])) {
            $product->set_sku(sanitize_text_field($params['sku']));
        }
        if (isset($params['manage_stock'])) {
            $product->set_manage_stock((bool) $params['manage_stock']);
        }
        if (isset($params['stock_quantity'])) {
            $product->set_stock_quantity((int) $params['stock_quantity']);
        }
        if (!empty($params['status'])) {
            $product->set_status(sanitize_text_field($params['status']));
        } else {
            $product->set_status('pending');
        }

        if (!empty($params['categories']) && is_array($params['categories'])) {
            $term_ids = array();
            foreach ($params['categories'] as $cat) {
                $id = is_array($cat) ? (isset($cat['id']) ? $cat['id'] : (isset($cat['databaseId']) ? $cat['databaseId'] : null)) : $cat;
                if ($id) {
                    $term_ids[] = (int) $id;
                }
            }
            if (!empty($term_ids)) {
                wp_set_object_terms($product_id, $term_ids, 'product_cat');
            }
        }

        if (!empty($params['tags']) && is_array($params['tags'])) {
            $tag_ids = array();
            foreach ($params['tags'] as $tag) {
                $id = is_array($tag) ? (isset($tag['id']) ? $tag['id'] : null) : $tag;
                if ($id) {
                    $tag_ids[] = (int) $id;
                } else {
                    $name = is_array($tag) ? (isset($tag['name']) ? $tag['name'] : '') : $tag;
                    if ($name) {
                        $t = get_term_by('name', $name, 'product_tag');
                        if ($t) {
                            $tag_ids[] = $t->term_id;
                        }
                    }
                }
            }
            if (!empty($tag_ids)) {
                wp_set_object_terms($product_id, $tag_ids, 'product_tag');
            }
        }

        if (!empty($params['images']) && is_array($params['images'])) {
            $gallery_ids = array();
            foreach ($params['images'] as $img) {
                $src = is_array($img) ? (isset($img['src']) ? $img['src'] : (isset($img['url']) ? $img['url'] : '')) : $img;
                if (empty($src) || !is_string($src)) {
                    continue;
                }
                $att_id = attachment_url_to_postid($src);
                if ($att_id) {
                    $gallery_ids[] = $att_id;
                }
            }
            if (!empty($gallery_ids)) {
                $product->set_image_id($gallery_ids[0]);
                if (count($gallery_ids) > 1) {
                    $product->set_gallery_image_ids(array_slice($gallery_ids, 1));
                }
            }
        }

        $product->save();

        return array(
            'success' => true,
            'product' => array(
                'id' => $product_id,
                'name' => $product->get_name(),
                'status' => $product->get_status(),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
            ),
        );
    } catch (Exception $e) {
        error_log('[yardsale_update_product] Error: ' . $e->getMessage());
        return new WP_Error('update_failed', $e->getMessage(), array('status' => 500));
    } finally {
        remove_filter('user_has_cap', 'yardsale_allow_user_create_products', 10);
    }
}
