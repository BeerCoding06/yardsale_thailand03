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
$result = fetchWooCommerceApi($url, 'GET', null, true); // Use Basic Auth

if (!$result['success']) {
    sendErrorResponse($result['error'] ?? 'Failed to fetch orders', $result['http_code'] ?: 500);
}

$orders = $result['data'] ?? [];

if (!is_array($orders)) {
    $orders = [];
}

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
        
        // Fetch products in batches
        $batches = array_chunk($productIds, 20);
        foreach ($batches as $batch) {
            $includeParam = implode(',', $batch);
            $wpUrl = $baseUrl . '/wp-json/wp/v2/product?include=' . urlencode($includeParam) . '&per_page=20';
            
            $wpResult = fetchWordPressApi($wpUrl, 'GET');
            if ($wpResult['success'] && is_array($wpResult['data'])) {
                foreach ($wpResult['data'] as $product) {
                    if (!empty($product['author'])) {
                        $productAuthors[$product['id']] = $product['author'];
                    }
                }
            }
        }
    }
    
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
            $filteredOrders[] = $order;
            error_log("[getOrders] Added order #{$order['id']} for seller {$sellerId}, seller_total: {$sellerTotal}");
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
