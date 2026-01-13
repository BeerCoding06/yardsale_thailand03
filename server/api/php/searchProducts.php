<?php
// API for searching WooCommerce products

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

try {
    // Get query parameters
    $search = isset($_GET['search']) ? sanitize_text_field($_GET['search']) : '';
    $limit = isset($_GET['limit']) ? min(100, max(1, intval($_GET['limit']))) : 6;
    
    if (empty($search)) {
        echo json_encode(array(
            'products' => array('nodes' => array())
        ));
        exit();
    }
    
    // Build query args - remove stock_status filter to show all products
    $args = array(
        'post_type' => 'product',
        'post_status' => 'publish',
        'posts_per_page' => $limit,
        's' => $search,
        // Remove meta_query to allow searching all products regardless of stock status
    );
    
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
            
            // Additional checks: ensure product is visible and purchasable
            if (!$product->is_visible() || !$product->is_purchasable()) {
                continue;
            }
            
            // Get product data
            $sku = $product->get_sku();
            $slug = $product->get_slug();
            $name = $product->get_name();
            $regular_price = $product->get_regular_price();
            $sale_price = $product->get_sale_price();
            
            // Format prices using WooCommerce price formatting
            $regular_price_formatted = '';
            $sale_price_formatted = '';
            
            if ($regular_price && $regular_price > 0) {
                $regular_price_formatted = wc_price($regular_price, array('decimals' => 2));
                if (empty($regular_price_formatted)) {
                    // Manual fallback if wc_price returns empty
                    $currency_symbol = get_woocommerce_currency_symbol();
                    $regular_price_formatted = '<span class="woocommerce-Price-amount amount">' . 
                                               '<span class="woocommerce-Price-currencySymbol">' . esc_html($currency_symbol) . '</span>' . 
                                               number_format($regular_price, 2, '.', ',') . 
                                               '</span>';
                }
            }
            
            if ($sale_price && $sale_price > 0) {
                $sale_price_formatted = wc_price($sale_price, array('decimals' => 2));
                if (empty($sale_price_formatted)) {
                    // Manual fallback if wc_price returns empty
                    $currency_symbol = get_woocommerce_currency_symbol();
                    $sale_price_formatted = '<span class="woocommerce-Price-amount amount">' . 
                                            '<span class="woocommerce-Price-currencySymbol">' . esc_html($currency_symbol) . '</span>' . 
                                            number_format($sale_price, 2, '.', ',') . 
                                            '</span>';
                }
            }
            
            // Get product image
            $image_id = $product->get_image_id();
            $image_url = null;
            if ($image_id) {
                $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
                if (!$image_url) {
                    $image_url = wp_get_attachment_image_url($image_id, 'full');
                }
            }
            
            // Get gallery images
            $gallery_ids = $product->get_gallery_image_ids();
            $gallery_images = array();
            foreach ($gallery_ids as $gallery_id) {
                $gallery_url = wp_get_attachment_image_url($gallery_id, 'woocommerce_thumbnail');
                if (!$gallery_url) {
                    $gallery_url = wp_get_attachment_image_url($gallery_id, 'full');
                }
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
            
            $products[] = array(
                'sku' => $sku,
                'slug' => $slug,
                'name' => $name,
                'regularPrice' => $regular_price_formatted ? $regular_price_formatted : ($regular_price ? $regular_price : ''),
                'salePrice' => $sale_price_formatted ? $sale_price_formatted : ($sale_price ? $sale_price : null),
                'stockQuantity' => $product->get_stock_quantity(),
                'allPaStyle' => array('nodes' => $pa_style),
                'image' => $image_url ? array('sourceUrl' => $image_url) : null,
                'galleryImages' => array('nodes' => $gallery_images),
            );
        }
        wp_reset_postdata();
    }
    
    // Return response in GraphQL-like format
    $response = array(
        'products' => array('nodes' => $products)
    );
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Internal server error: ' . $e->getMessage();
    error_log('[searchProducts] Error: ' . $error_message);
    error_log('[searchProducts] Stack trace: ' . $e->getTraceAsString());
    
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage(),
        'products' => array('nodes' => array()) // Return empty products on error
    ], JSON_UNESCAPED_UNICODE);
}

