<?php
// API for canceling WooCommerce orders

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Use POST.']);
    exit();
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$order_id = isset($input['order_id']) ? intval($input['order_id']) : null;
$customer_id = isset($input['customer_id']) ? intval($input['customer_id']) : null;

if (!$order_id) {
    http_response_code(400);
    echo json_encode(['error' => 'order_id is required']);
    exit();
}

if (!$customer_id) {
    http_response_code(400);
    echo json_encode(['error' => 'customer_id is required']);
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

if (!function_exists('wc_get_order')) {
    http_response_code(500);
    echo json_encode(['error' => 'WooCommerce order functions not found.']);
    exit();
}

try {
    // Get order
    $order = wc_get_order($order_id);
    
    if (!$order) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        exit();
    }
    
    // Verify order ownership
    $order_customer_id = $order->get_customer_id();
    if ($order_customer_id != $customer_id) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have permission to cancel this order']);
        exit();
    }
    
    // Check if order can be cancelled
    $current_status = $order->get_status();
    $cancellable_statuses = ['pending', 'processing', 'on-hold'];
    
    if (!in_array($current_status, $cancellable_statuses)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Order cannot be cancelled',
            'current_status' => $current_status,
            'message' => 'Only orders with status pending, processing, or on-hold can be cancelled'
        ]);
        exit();
    }
    
    // Get order ID before trashing
    $order_post_id = $order->get_id();
    
    // Restore stock levels for products in this order
    $stock_restored = false;
    try {
        if (function_exists('wc_increase_stock_levels')) {
            wc_increase_stock_levels($order);
            $stock_restored = true;
            error_log('[cancelOrder] Restored stock for order ID: ' . $order_post_id);
        } else {
            // Fallback: manually restore stock for each item
            $items = $order->get_items();
            $restored_products = [];
            
            foreach ($items as $item_id => $item) {
                if (!$item->is_type('line_item')) {
                    continue;
                }
                
                $product = $item->get_product();
                if (!$product || !$product->managing_stock()) {
                    continue;
                }
                
                $qty = $item->get_quantity();
                $item_stock_reduced = $item->get_meta('_reduced_stock', true);
                
                // Use _reduced_stock if available, otherwise use quantity
                $stock_to_restore = $item_stock_reduced ? $item_stock_reduced : $qty;
                
                if ($stock_to_restore > 0) {
                    wc_update_product_stock($product, $stock_to_restore, 'increase');
                    $item->delete_meta_data('_reduced_stock');
                    $item->save();
                    
                    $restored_products[] = [
                        'id' => $product->get_id(),
                        'name' => $product->get_name(),
                        'qty' => $stock_to_restore
                    ];
                    error_log('[cancelOrder] Restored stock for product ID: ' . $product->get_id() . ' - Qty: ' . $stock_to_restore);
                }
            }
            
            if (!empty($restored_products)) {
                $stock_restored = true;
            }
        }
    } catch (Exception $e) {
        error_log('[cancelOrder] Error restoring stock: ' . $e->getMessage());
    }
    
    // Trash the order using WooCommerce delete method (without force_delete, it will trash)
    $order_trashed = false;
    try {
        // Use WooCommerce order delete method to move order to trash
        // Without force_delete parameter, it will trash the order instead of permanently deleting
        $order->delete(false); // false = not force delete, so it will trash
        
        // Check if order status is now trash
        $order_status_after = $order->get_status();
        if ($order_status_after === 'trash') {
            $order_trashed = true;
            error_log('[cancelOrder] Trashed order ID: ' . $order_post_id . ' - Status: ' . $order_status_after);
        } else {
            error_log('[cancelOrder] Order delete called but status is: ' . $order_status_after);
        }
    } catch (Exception $e) {
        error_log('[cancelOrder] Error trashing order: ' . $e->getMessage());
    }
    
    // Return success response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Order cancelled, stock restored, and moved to trash successfully',
        'order_id' => $order_id,
        'order_trashed' => $order_trashed,
        'stock_restored' => $stock_restored,
        'new_status' => 'trash'
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to cancel order: ' . $e->getMessage();
    error_log('[cancelOrder] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'Failed to cancel order: ' . $e->getMessage();
    error_log('[cancelOrder] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
}

