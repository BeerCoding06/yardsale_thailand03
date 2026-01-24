<?php
// API for fetching WooCommerce products

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load WordPress
$wp_load_path = __DIR__ . '/../../../wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wordpress/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress not found']);
    exit();
}

require_once $wp_load_path;

// Helper function to replace localhost URLs with correct domain
function fix_image_url($url) {
    if (!$url) return $url;
    
    $wp_home = getenv('WP_HOME') ?: (defined('WP_HOME') ? WP_HOME : '');
    if ($wp_home) {
        // Replace localhost and 127.0.0.1 with correct domain
        // Handle both with and without /wordpress prefix
        $wp_home_trimmed = rtrim($wp_home, '/');
        
        // CRITICAL: Fix duplicate /wordpress/wordpress/ FIRST
        $url = preg_replace('#(/wordpress/wordpress/)#', '/wordpress/', $url);
        $url = preg_replace('#(/wordpress/wordpress)$#', '/wordpress', $url);
        
        // Replace http://localhost/wordpress with correct domain
        $url = str_replace('http://localhost/wordpress', $wp_home_trimmed . '/wordpress', $url);
        $url = str_replace('http://127.0.0.1/wordpress', $wp_home_trimmed . '/wordpress', $url);
        
        // Replace http://localhost (without /wordpress) with correct domain/wordpress
        $url = str_replace('http://localhost/', $wp_home_trimmed . '/wordpress/', $url);
        $url = str_replace('http://127.0.0.1/', $wp_home_trimmed . '/wordpress/', $url);
        
        // Also handle https
        $url = str_replace('https://localhost/wordpress', $wp_home_trimmed . '/wordpress', $url);
        $url = str_replace('https://127.0.0.1/wordpress', $wp_home_trimmed . '/wordpress', $url);
        $url = str_replace('https://localhost/', $wp_home_trimmed . '/wordpress/', $url);
        $url = str_replace('https://127.0.0.1/', $wp_home_trimmed . '/wordpress/', $url);
        
        // Final cleanup: Remove any duplicate /wordpress/wordpress/ that might have been created
        $url = preg_replace('#(/wordpress/wordpress/)#', '/wordpress/', $url);
        $url = preg_replace('#(/wordpress/wordpress)$#', '/wordpress', $url);
    }
    return $url;
}

try {
    // Get query parameters
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $per_page = isset($_GET['per_page']) ? min(100, max(1, intval($_GET['per_page']))) : 21;
    $search = isset($_GET['search']) ? sanitize_text_field($_GET['search']) : '';
    $category = isset($_GET['category']) ? sanitize_text_field($_GET['category']) : '';
    $order = isset($_GET['order']) ? strtoupper(sanitize_text_field($_GET['order'])) : 'DESC';
    $orderby = isset($_GET['orderby']) ? sanitize_text_field($_GET['orderby']) : 'date';
    
    // Validate order
    if (!in_array($order, ['ASC', 'DESC'])) {
        $order = 'DESC';
    }
    
    // Map orderby
    $orderby_map = array(
        'DATE' => 'date',
        'TITLE' => 'title',
        'PRICE' => 'meta_value_num',
        'RATING' => 'rating',
        'POPULARITY' => 'popularity',
    );
    $wp_orderby = isset($orderby_map[$orderby]) ? $orderby_map[$orderby] : 'date';
    
    // Build query args
    $args = array(
        'post_type' => 'product',
        'post_status' => 'publish',
        'posts_per_page' => $per_page,
        'paged' => $page,
        'orderby' => $wp_orderby,
        'order' => $order,
        'meta_query' => array(
            array(
                'key' => '_stock_status',
                'value' => 'instock',
                'compare' => '=',
            ),
        ),
        'tax_query' => array(
            'relation' => 'AND',
            // Exclude products hidden from catalog
            array(
                'taxonomy' => 'product_visibility',
                'field' => 'slug',
                'terms' => array('exclude-from-catalog', 'exclude-from-search'),
                'operator' => 'NOT IN',
            ),
        ),
    );
    
    // Add search
    if (!empty($search)) {
        $args['s'] = $search;
    }
    
    // Add category filter
    if (!empty($category)) {
        // Try to find category by name first, then by slug
        $category_term = get_term_by('name', $category, 'product_cat');
        if (!$category_term) {
            $category_term = get_term_by('slug', sanitize_title($category), 'product_cat');
        }
        
        if ($category_term && !is_wp_error($category_term)) {
            // Add category filter to existing tax_query
            $args['tax_query'][] = array(
                'taxonomy' => 'product_cat',
                'field' => 'term_id',
                'terms' => $category_term->term_id,
            );
        } else {
            // Fallback: try by name (case-insensitive)
            $args['tax_query'][] = array(
                'taxonomy' => 'product_cat',
                'field' => 'name',
                'terms' => $category,
                'operator' => 'LIKE',
            );
        }
    }
    
    // Handle price ordering
    if ($wp_orderby === 'meta_value_num') {
        $args['meta_key'] = '_price';
    }
    
    // Query products
    $query = new WP_Query($args);
    
    $products = array();
    
    if ($query->have_posts()) {
        while ($query->have_posts()) {
            $query->the_post();
            $product = wc_get_product(get_the_ID());
            
            // Only fetch simple products
            if (!$product || $product->get_type() !== 'simple') {
                continue;
            }
            
            // Additional check: ensure product is visible
            if (!$product->is_visible()) {
                continue;
            }
            
            // Check if product is purchasable (has price)
            if (!$product->is_purchasable()) {
                continue;
            }
            
            // Get product data
            $sku = $product->get_sku();
            $slug = $product->get_slug();
            $name = $product->get_name();
            
            // Get prices and format them
            // For simple products, get prices directly
            $regular_price_raw = $product->get_regular_price();
            $sale_price_raw = $product->get_sale_price();
            
            // Fallback: if no regular price, use get_price()
            if (empty($regular_price_raw) || $regular_price_raw <= 0) {
                $regular_price_raw = $product->get_price();
            }
            
            // Format prices with currency (HTML format for v-html)
            $regular_price = '';
            $sale_price = '';
            
            // Format regular price - ensure we always have a price
            if ($regular_price_raw && $regular_price_raw > 0) {
                // Try wc_price() first
                $formatted = wc_price($regular_price_raw, array('decimals' => 0));
                if (!empty($formatted) && $formatted !== '') {
                    $regular_price = $formatted;
                } else {
                    // Fallback: format manually
                    $currency_symbol = get_woocommerce_currency_symbol();
                    $regular_price = '<span class="woocommerce-Price-amount amount">' . 
                                    '<span class="woocommerce-Price-currencySymbol">' . $currency_symbol . '</span>' . 
                                    number_format($regular_price_raw, 0) . 
                                    '</span>';
                }
            } else {
                // Try get_price() as last resort
                $fallback_price = $product->get_price();
                if ($fallback_price && $fallback_price > 0) {
                    $formatted = wc_price($fallback_price, array('decimals' => 0));
                    if (!empty($formatted)) {
                        $regular_price = $formatted;
                    } else {
                        $currency_symbol = get_woocommerce_currency_symbol();
                        $regular_price = '<span class="woocommerce-Price-amount amount">' . 
                                        '<span class="woocommerce-Price-currencySymbol">' . $currency_symbol . '</span>' . 
                                        number_format($fallback_price, 0) . 
                                        '</span>';
                    }
                }
            }
            
            // Format sale price
            if ($sale_price_raw && $sale_price_raw > 0) {
                $formatted = wc_price($sale_price_raw, array('decimals' => 0));
                if (!empty($formatted) && $formatted !== '') {
                    $sale_price = $formatted;
                } else {
                    // Fallback: format manually
                    $currency_symbol = get_woocommerce_currency_symbol();
                    $sale_price = '<span class="woocommerce-Price-amount amount">' . 
                                 '<span class="woocommerce-Price-currencySymbol">' . $currency_symbol . '</span>' . 
                                 number_format($sale_price_raw, 0) . 
                                 '</span>';
                }
            }
            
            // Get stock quantity for simple products
            $stock_quantity = $product->get_stock_quantity();
            $stock_status = $product->get_stock_status();
            
            // If product status is cancelled, show as in stock
            $product_status = $product->get_status();
            if ($product_status === 'cancelled') {
                $stock_status = 'instock';
            }
            
            // Get product image
            $image_id = $product->get_image_id();
            $image_url = null;
            if ($image_id) {
                $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
                if (!$image_url) {
                    $image_url = wp_get_attachment_image_url($image_id, 'full');
                }
                // Fix URL to use correct domain
                $image_url = fix_image_url($image_url);
            }
            
            // Get gallery images
            $gallery_ids = $product->get_gallery_image_ids();
            $gallery_images = array();
            foreach ($gallery_ids as $gallery_id) {
                $gallery_url = wp_get_attachment_image_url($gallery_id, 'woocommerce_thumbnail');
                if (!$gallery_url) {
                    $gallery_url = wp_get_attachment_image_url($gallery_id, 'full');
                }
                // Fix URL to use correct domain
                $gallery_url = fix_image_url($gallery_url);
                if ($gallery_url) {
                    $gallery_images[] = array('sourceUrl' => $gallery_url);
                }
            }
            
            // Get PA Style attribute
            $pa_style = array();
            $attributes = $product->get_attribute('pa_style');
            if ($attributes) {
                $style_terms = explode(', ', $attributes);
                foreach ($style_terms as $term_name) {
                    $pa_style[] = array('name' => trim($term_name));
                }
            }
            
            // Ensure prices are always strings (not null)
            $regular_price_final = $regular_price ? $regular_price : '';
            $sale_price_final = $sale_price ? $sale_price : '';
            
            $products[] = array(
                'sku' => $sku,
                'slug' => $slug,
                'name' => $name,
                'regularPrice' => $regular_price_final,
                'salePrice' => $sale_price_final,
                'stockQuantity' => $stock_quantity,
                'stockStatus' => strtoupper($stock_status),
                'allPaStyle' => array('nodes' => $pa_style),
                'image' => $image_url ? array('sourceUrl' => $image_url) : null,
                'galleryImages' => array('nodes' => $gallery_images),
            );
        }
        wp_reset_postdata();
    }
    
    // Calculate pagination
    $total_pages = $query->max_num_pages;
    $has_next_page = $page < $total_pages;
    
    // Generate cursor (simple implementation using page number)
    $end_cursor = $has_next_page ? base64_encode('page:' . ($page + 1)) : null;
    
    // Return response in GraphQL-like format
    echo json_encode(array(
        'products' => array(
            'nodes' => $products,
            'pageInfo' => array(
                'hasNextPage' => $has_next_page,
                'endCursor' => $end_cursor,
            ),
        ),
    ));
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
    error_log('[getProducts] Error: ' . $e->getMessage());
}

