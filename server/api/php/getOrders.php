<?php
/**
 * Get Orders from WooCommerce REST API
 * 
 * Endpoint: GET /server/api/php/getOrders.php
 * Query params: customer_id, customer_email, status, per_page, page
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get query parameters
$customerId = isset($_GET['customer_id']) ? $_GET['customer_id'] : null;
$customerEmail = isset($_GET['customer_email']) ? $_GET['customer_email'] : null;
$status = isset($_GET['status']) ? $_GET['status'] : null;
$sellerId = isset($_GET['seller_id']) ? (int)$_GET['seller_id'] : null;
$per_page = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 100;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;

// Build API parameters
$params = [
    'per_page' => $per_page,
    'page' => $page
];

if ($customerId) {
    $params['customer'] = $customerId;
}

if ($customerEmail) {
    $params['customer_email'] = $customerEmail;
}

if ($status) {
    $params['status'] = $status;
}

// Build API URL
$url = buildWcApiUrl('wc/v3/orders', $params, true); // Use Basic Auth

// Fetch from WooCommerce API
error_log("[getOrders] Fetching orders from WooCommerce API with params: " . json_encode($params));
$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    error_log("[getOrders] WooCommerce API error: " . ($result['error'] ?? 'Unknown error') . " (HTTP: " . ($result['http_code'] ?? 'N/A') . ")");
    sendErrorResponse($result['error'] ?? 'Failed to fetch orders', $result['http_code'] ?: 500);
}

$orders = $result['data'] ?? [];

if (!is_array($orders)) {
    $orders = [];
}

error_log("[getOrders] Fetched " . count($orders) . " orders from WooCommerce API");

// Filter by seller_id if provided
if ($sellerId) {
    // Collect all unique product IDs from orders
    $productIds = [];
    foreach ($orders as $order) {
        if (!empty($order['line_items']) && is_array($order['line_items'])) {
            foreach ($order['line_items'] as $item) {
                if (!empty($item['product_id'])) {
                    $productIds[] = $item['product_id'];
                }
            }
        }
    }
    
    // Fetch products from WordPress REST API to get authors
    $productAuthors = [];
    if (!empty($productIds)) {
        $productIds = array_unique($productIds);
        $baseUrl = rtrim(WC_BASE_URL, '/');
        
        error_log("[getOrders] Fetching product authors for " . count($productIds) . " unique product IDs for seller {$sellerId}");
        
        // Fetch products in batches
        $batches = array_chunk($productIds, 20);
        foreach ($batches as $batch) {
            $includeParam = implode(',', $batch);
            $wpUrl = $baseUrl . '/wp-json/wp/v2/product?include=' . urlencode($includeParam) . '&per_page=20';
            
            error_log("[getOrders] Fetching product batch from WordPress API: " . $wpUrl);
            
            $wpResult = fetchWordPressApi($wpUrl, 'GET');
            if ($wpResult['success'] && is_array($wpResult['data'])) {
                foreach ($wpResult['data'] as $product) {
                    if (!empty($product['author'])) {
                        $productAuthors[$product['id']] = $product['author'];
                        error_log("[getOrders] Product ID {$product['id']} has author: {$product['author']} (looking for seller {$sellerId})");
                    }
                }
            } else {
                error_log("[getOrders] Failed to fetch products from WordPress API: " . ($wpResult['error'] ?? 'Unknown error') . " (HTTP: " . ($wpResult['http_code'] ?? 'N/A') . ")");
            }
        }
    } else {
        error_log("[getOrders] No product IDs found in orders");
    }
    
    error_log("[getOrders] Found " . count($productAuthors) . " product authors");
    
    // Filter orders by seller_id and calculate seller_total
    $filteredOrders = [];
    foreach ($orders as $order) {
        $sellerTotal = 0;
        $sellerLineItems = [];
        $hasSellerProduct = false;
        
        if (!empty($order['line_items']) && is_array($order['line_items'])) {
            foreach ($order['line_items'] as $item) {
                if (!empty($item['product_id'])) {
                    $productId = $item['product_id'];
                    if (isset($productAuthors[$productId]) && (int)$productAuthors[$productId] === $sellerId) {
                        $hasSellerProduct = true;
                        // Calculate total for this seller's product
                        $itemTotal = isset($item['total']) ? (float)$item['total'] : 0;
                        $sellerTotal += $itemTotal;
                        $sellerLineItems[] = $item;
                        error_log("[getOrders] Found seller product - Order #{$order['id']}, Product ID: {$productId}, Item Total: {$itemTotal}");
                    }
                }
            }
        }
        
        // Only include orders that have products from this seller
        if ($hasSellerProduct) {
            // Add seller_total and seller_line_items to order
            $order['seller_total'] = $sellerTotal;
            $order['seller_line_items'] = $sellerLineItems;
            
            // Extract and format payment status information from WooCommerce order
            // WooCommerce orders have these payment-related fields:
            // - date_paid: Date when order was paid (null if not paid)
            // - payment_method: Payment method ID (e.g., 'bacs', 'cod', 'stripe')
            // - payment_method_title: Display name of payment method
            // - transaction_id: Transaction ID from payment gateway
            // - status: Order status (pending, processing, completed, etc.)
            // - total: Total order amount
            // - currency: Order currency
            
            $order['is_paid'] = isset($order['date_paid']) && !empty($order['date_paid']) && $order['date_paid'] !== '0000-00-00 00:00:00';
            
            // Determine payment status based on WooCommerce order data
            if ($order['is_paid']) {
                $order['payment_status'] = 'paid';
            } elseif (isset($order['status'])) {
                // Map WooCommerce order status to payment status
                switch ($order['status']) {
                    case 'completed':
                        $order['payment_status'] = 'paid'; // Completed orders are usually paid
                        break;
                    case 'processing':
                        $order['payment_status'] = 'processing'; // Processing payment
                        break;
                    case 'on-hold':
                        $order['payment_status'] = 'on_hold'; // Payment on hold
                        break;
                    case 'failed':
                        $order['payment_status'] = 'failed'; // Payment failed
                        break;
                    case 'refunded':
                        $order['payment_status'] = 'refunded'; // Payment refunded
                        break;
                    case 'cancelled':
                        $order['payment_status'] = 'cancelled'; // Order cancelled
                        break;
                    default:
                        $order['payment_status'] = 'pending'; // Default to pending
                }
            } else {
                $order['payment_status'] = 'pending';
            }
            
            // Preserve all payment-related fields from WooCommerce
            $order['date_paid'] = $order['date_paid'] ?? null;
            $order['payment_method'] = $order['payment_method'] ?? null;
            $order['payment_method_title'] = $order['payment_method_title'] ?? $order['payment_method'] ?? null;
            $order['transaction_id'] = $order['transaction_id'] ?? null;
            $order['order_status'] = $order['status'] ?? null;
            $order['total'] = isset($order['total']) ? (float)$order['total'] : 0;
            $order['currency'] = $order['currency'] ?? 'THB';
            
            $filteredOrders[] = $order;
            error_log("[getOrders] Added order #{$order['id']} for seller {$sellerId}, seller_total: {$sellerTotal}, payment_status: {$order['payment_status']}, is_paid: " . ($order['is_paid'] ? 'true' : 'false'));
        }
    }
    
    error_log("[getOrders] Filtered orders count: " . count($filteredOrders) . " for seller {$sellerId}");
    error_log("[getOrders] Product authors found: " . count($productAuthors));
    
    $orders = $filteredOrders;
}

// Return response
sendJsonResponse([
    'orders' => $orders,
    'count' => count($orders)
]);

?>
