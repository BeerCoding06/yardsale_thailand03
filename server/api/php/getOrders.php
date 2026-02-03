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

// Build API URL - WooCommerce REST API uses consumer_key/consumer_secret in query params
$url = buildWcApiUrl('wc/v3/orders', $params, false); // Use consumer_key/consumer_secret in query params

// Fetch from WooCommerce API
error_log("[getOrders] Fetching orders from WooCommerce API with params: " . json_encode($params));
error_log("[getOrders] WooCommerce API URL: " . preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url));
$result = fetchWooCommerceApi($url, 'GET', null, false); // Use consumer_key/consumer_secret (not Basic Auth)

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
    
    // Fetch products from WooCommerce API to get authors (post_author field)
    // WooCommerce products have post_author field that contains the seller/user ID
    $productAuthors = [];
    if (!empty($productIds)) {
        $productIds = array_unique($productIds);
        
        error_log("[getOrders] Fetching product authors for " . count($productIds) . " unique product IDs for seller {$sellerId}");
        error_log("[getOrders] Product IDs: " . implode(', ', array_slice($productIds, 0, 10)) . (count($productIds) > 10 ? '...' : ''));
        
        // Fetch products from WooCommerce API in batches
        $batches = array_chunk($productIds, 20);
        foreach ($batches as $batch) {
            $includeParam = implode(',', $batch);
            $wcUrl = buildWcApiUrl('wc/v3/products', [
                'include' => $includeParam,
                'per_page' => 20
            ], false); // Use consumer_key/consumer_secret in query params
            
            error_log("[getOrders] Fetching product batch from WooCommerce API (products: {$includeParam})");
            error_log("[getOrders] WooCommerce API URL: " . preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $wcUrl));
            
            $wcResult = fetchWooCommerceApi($wcUrl, 'GET', null, false); // Use consumer_key/consumer_secret (not Basic Auth)
            if ($wcResult['success'] && is_array($wcResult['data'])) {
                error_log("[getOrders] WooCommerce API returned " . count($wcResult['data']) . " products");
                foreach ($wcResult['data'] as $product) {
                    $productId = $product['id'] ?? null;
                    if (!$productId) {
                        error_log("[getOrders] Product missing ID field. Available keys: " . implode(', ', array_keys($product)));
                        continue;
                    }
                    
                    // Log all available fields for debugging
                    error_log("[getOrders] Product ID {$productId} - Available fields: " . implode(', ', array_keys($product)));
                    
                    // WooCommerce API returns post_author or we can get it from meta
                    $author = null;
                    
                    // Try different fields where author might be stored
                    if (!empty($product['post_author'])) {
                        $author = (int)$product['post_author'];
                        error_log("[getOrders] Found author from post_author field: {$author}");
                    } elseif (!empty($product['author'])) {
                        $author = (int)$product['author'];
                        error_log("[getOrders] Found author from author field: {$author}");
                    } elseif (!empty($product['meta_data']) && is_array($product['meta_data'])) {
                        error_log("[getOrders] Checking meta_data for product {$productId} (count: " . count($product['meta_data']) . ")");
                        // Try to find author in meta_data
                        foreach ($product['meta_data'] as $meta) {
                            if (isset($meta['key']) && ($meta['key'] === '_product_author' || $meta['key'] === 'author')) {
                                $author = (int)$meta['value'];
                                error_log("[getOrders] Found author from meta_data[{$meta['key']}]: {$author}");
                                break;
                            }
                        }
                    }
                    
                    if ($productId && $author) {
                        $productAuthors[$productId] = $author;
                        error_log("[getOrders] Product ID {$productId} has author: {$author} (looking for seller {$sellerId})");
                    } else {
                        error_log("[getOrders] Product ID {$productId} has no author field found. Trying database query...");
                        
                        // Fallback: Query database directly to get post_author
                        try {
                            $dbHost = getenv('DB_HOST') ?: 'wp_db';
                            $dbPort = getenv('DB_PORT') ?: '3306';
                            $dbName = getenv('DB_DATABASE') ?: 'wordpress';
                            $dbUser = getenv('DB_USER') ?: 'wpuser';
                            $dbPass = getenv('DB_PASSWORD') ?: 'wppass';
                            
                            $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
                            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                            ]);
                            
                            // Get table prefix
                            $tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';
                            
                            // Query post_author from wp_posts table
                            $stmt = $pdo->prepare("SELECT post_author FROM {$tablePrefix}posts WHERE ID = ? AND post_type = 'product'");
                            $stmt->execute([$productId]);
                            $post = $stmt->fetch();
                            
                            if ($post && !empty($post['post_author'])) {
                                $author = (int)$post['post_author'];
                                $productAuthors[$productId] = $author;
                                error_log("[getOrders] Product ID {$productId} has author from database: {$author}");
                            } else {
                                error_log("[getOrders] Product ID {$productId} not found in database or has no post_author");
                            }
                        } catch (Exception $e) {
                            error_log("[getOrders] Database query failed for product {$productId}: " . $e->getMessage());
                        }
                    }
                }
            } else {
                error_log("[getOrders] Failed to fetch products from WooCommerce API: " . ($wcResult['error'] ?? 'Unknown error') . " (HTTP: " . ($wcResult['http_code'] ?? 'N/A') . ")");
                if (!empty($wcResult['raw_response'])) {
                    error_log("[getOrders] WooCommerce API raw response: " . substr($wcResult['raw_response'], 0, 500));
                }
            }
        }
        
        // Fallback: Query database directly for products that don't have authors yet
        $missingProductIds = array_diff($productIds, array_keys($productAuthors));
        if (!empty($missingProductIds)) {
            error_log("[getOrders] Querying database for " . count($missingProductIds) . " products without authors: " . implode(', ', $missingProductIds));
            try {
                // Use same database config as login.php
                $dbHostEnv = getenv('DB_HOST');
                $dbHost = $dbHostEnv ?: 'wp_db';
                $dbPort = getenv('DB_PORT') ?: '3306';
                $dbName = getenv('DB_DATABASE') ?: getenv('MYSQL_DATABASE') ?: 'wordpress';
                $dbUserEnv = getenv('DB_USER');
                $dbUser = $dbUserEnv ?: getenv('MYSQL_USER') ?: 'wpuser';
                $dbPasswordEnv = getenv('DB_PASSWORD');
                $dbPassword = $dbPasswordEnv ?: getenv('MYSQL_PASSWORD') ?: 'wppass';
                
                // Extract host only (remove port if present)
                $dbHostOnly = $dbHost;
                if (strpos($dbHost, ':') !== false) {
                    $parts = explode(':', $dbHost);
                    $dbHostOnly = $parts[0];
                    if (count($parts) > 1 && empty($dbPort)) {
                        $dbPort = $parts[1];
                    }
                }
                
                error_log("[getOrders] Database config - Host: {$dbHostOnly}, Port: {$dbPort}, DB: {$dbName}, User: {$dbUser}");
                
                $dsn = "mysql:host={$dbHostOnly};port={$dbPort};dbname={$dbName};charset=utf8mb4";
                $pdo = new PDO($dsn, $dbUser, $dbPassword, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 10
                ]);
                
                error_log("[getOrders] Database connection successful");
                
                // Get table prefix
                $tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';
                error_log("[getOrders] Using table prefix: {$tablePrefix}");
                
                // Query all products at once using IN clause
                $placeholders = implode(',', array_fill(0, count($missingProductIds), '?'));
                $query = "SELECT ID, post_author, post_type FROM {$tablePrefix}posts WHERE ID IN ({$placeholders})";
                error_log("[getOrders] Executing query: SELECT ID, post_author, post_type FROM {$tablePrefix}posts WHERE ID IN (" . implode(',', $missingProductIds) . ")");
                
                $stmt = $pdo->prepare($query);
                $stmt->execute($missingProductIds);
                $posts = $stmt->fetchAll();
                
                error_log("[getOrders] Database returned " . count($posts) . " rows");
                
                foreach ($posts as $post) {
                    error_log("[getOrders] Database row - ID: {$post['ID']}, post_type: {$post['post_type']}, post_author: {$post['post_author']}");
                    if (!empty($post['post_author']) && !empty($post['ID'])) {
                        $productAuthors[$post['ID']] = (int)$post['post_author'];
                        error_log("[getOrders] ✓ Product ID {$post['ID']} has author from database: {$post['post_author']}");
                    }
                }
                
                error_log("[getOrders] Database query found " . count($posts) . " products, added " . count(array_intersect_key($productAuthors, array_flip($missingProductIds))) . " authors");
            } catch (Exception $e) {
                error_log("[getOrders] Database query failed: " . $e->getMessage());
                error_log("[getOrders] Database error trace: " . $e->getTraceAsString());
            }
        }
        
        // Final fallback: Try WordPress REST API if still no authors
        if (empty($productAuthors)) {
            error_log("[getOrders] No authors found from WooCommerce API or database, trying WordPress REST API as final fallback");
            $baseUrl = rtrim(WC_BASE_URL, '/');
            $batches = array_chunk($productIds, 20);
            foreach ($batches as $batch) {
                $includeParam = implode(',', $batch);
                $wpUrl = $baseUrl . '/wp-json/wp/v2/product?include=' . urlencode($includeParam) . '&per_page=20';
                
                error_log("[getOrders] Fetching product batch from WordPress API: " . $wpUrl);
                
                $wpResult = fetchWordPressApi($wpUrl, 'GET');
                if ($wpResult['success'] && is_array($wpResult['data'])) {
                    foreach ($wpResult['data'] as $product) {
                        if (!empty($product['author']) && !empty($product['id'])) {
                            $productAuthors[$product['id']] = $product['author'];
                            error_log("[getOrders] Product ID {$product['id']} has author: {$product['author']} (from WordPress API)");
                        }
                    }
                } else {
                    error_log("[getOrders] Failed to fetch products from WordPress API: " . ($wpResult['error'] ?? 'Unknown error') . " (HTTP: " . ($wpResult['http_code'] ?? 'N/A') . ")");
                }
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

// Return response with debug info
$response = [
    'orders' => $orders,
    'count' => count($orders),
    'success' => true
];

// Add debug information to response (only if seller_id is provided)
if ($sellerId) {
    $response['debug'] = [
        'seller_id' => $sellerId,
        'total_orders_from_wc' => isset($result['data']) ? count($result['data']) : 0,
        'product_ids_found' => isset($productIds) ? count($productIds) : 0,
        'unique_product_ids' => isset($productIds) ? count(array_unique($productIds)) : 0,
        'product_authors_found' => isset($productAuthors) ? count($productAuthors) : 0,
        'filtered_orders_count' => count($orders),
        'sample_product_ids' => isset($productIds) && !empty($productIds) ? array_slice(array_unique($productIds), 0, 10) : [],
        'sample_product_authors' => isset($productAuthors) && !empty($productAuthors) ? array_slice($productAuthors, 0, 10, true) : [],
    ];
    
    error_log("[getOrders] Debug info: " . json_encode($response['debug']));
}

sendJsonResponse($response);

?>
