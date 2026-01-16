<?php
// API for fetching a single WooCommerce product by slug or sku

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
    }
    return $url;
}

try {
    // Get query parameters
    $slug = isset($_GET['slug']) ? sanitize_text_field($_GET['slug']) : '';
    $sku = isset($_GET['sku']) ? sanitize_text_field($_GET['sku']) : '';
    
    if (empty($slug) && empty($sku)) {
        http_response_code(400);
        echo json_encode(['error' => 'slug or sku is required']);
        exit();
    }
    
    $product = null;
    
    // Try to find product by slug first
    if (!empty($slug)) {
        $args = array(
            'post_type' => 'product',
            'post_status' => array('publish', 'trash'), // Include trashed products
            'name' => $slug,
            'posts_per_page' => 1,
        );
        
        $query = new WP_Query($args);
        if ($query->have_posts()) {
            $query->the_post();
            $product = wc_get_product(get_the_ID());
            wp_reset_postdata();
        }
    }
    
    // If not found by slug, try by SKU
    if (!$product && !empty($sku)) {
        $product_id = wc_get_product_id_by_sku($sku);
        if ($product_id) {
            $product = wc_get_product($product_id);
        }
    }
    
    if (!$product) {
        echo json_encode(array('product' => null));
        exit();
    }
    
    // Allow trashed products to be shown (for adding to cart)
    // No need to filter out trashed products
    
    // Only fetch simple products
    if ($product->get_type() !== 'simple') {
        echo json_encode(array('product' => null));
        exit();
    }
    
    // Additional checks
    if (!$product->is_visible() || !$product->is_purchasable()) {
        echo json_encode(array('product' => null));
        exit();
    }
    
    // Get product data
    $product_id = $product->get_id();
    $product_sku = $product->get_sku();
    $product_slug = $product->get_slug();
    $product_name = $product->get_name();
    $product_description = $product->get_description();
    
    // Get prices
    $regular_price_raw = $product->get_regular_price();
    $sale_price_raw = $product->get_sale_price();
    
    // Fallback: if no regular price, use get_price()
    if (empty($regular_price_raw) || $regular_price_raw <= 0) {
        $regular_price_raw = $product->get_price();
    }
    
    // Format prices using WooCommerce price formatting
    $regular_price = '';
    $sale_price = '';
    
    if ($regular_price_raw && $regular_price_raw > 0) {
        $regular_price = wc_price($regular_price_raw, array('decimals' => 2));
        if (empty($regular_price)) {
            // Manual fallback if wc_price returns empty
            $currency_symbol = get_woocommerce_currency_symbol();
            $regular_price = '<span class="woocommerce-Price-amount amount">' . 
                           '<span class="woocommerce-Price-currencySymbol">' . esc_html($currency_symbol) . '</span>' . 
                           number_format($regular_price_raw, 2, '.', ',') . 
                           '</span>';
        }
    }
    
    if ($sale_price_raw && $sale_price_raw > 0) {
        $sale_price = wc_price($sale_price_raw, array('decimals' => 2));
        if (empty($sale_price)) {
            // Manual fallback if wc_price returns empty
            $currency_symbol = get_woocommerce_currency_symbol();
            $sale_price = '<span class="woocommerce-Price-amount amount">' . 
                         '<span class="woocommerce-Price-currencySymbol">' . esc_html($currency_symbol) . '</span>' . 
                         number_format($sale_price_raw, 2, '.', ',') . 
                         '</span>';
        }
    }
    
    // Get stock quantity
    $stock_quantity = $product->get_stock_quantity();
    $stock_status = $product->get_stock_status();
    
    // Get product status
    $product_status = $product->get_status();
    
    // If product status is cancelled or trash, show as in stock (allow adding to cart)
    if ($product_status === 'cancelled' || $product_status === 'trash') {
        $stock_status = 'instock';
    }
    
    // Get product image
    $image_id = $product->get_image_id();
    $image_url = null;
    if ($image_id) {
        $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_single');
        if (!$image_url) {
            $image_url = wp_get_attachment_image_url($image_id, 'large');
        }
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
        $gallery_url = wp_get_attachment_image_url($gallery_id, 'woocommerce_single');
        if (!$gallery_url) {
            $gallery_url = wp_get_attachment_image_url($gallery_id, 'large');
        }
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
    
    // Get PA Color attribute
    $pa_color = array();
    $color_attributes = $product->get_attribute('pa_color');
    if ($color_attributes) {
        $color_terms = explode(', ', $color_attributes);
        foreach ($color_terms as $term_name) {
            $pa_color[] = array('name' => trim($term_name));
        }
    }
    
    // Get related products (simple products only)
    $related_ids = wc_get_related_products($product_id, 50);
    $related_products = array();
    foreach ($related_ids as $related_id) {
        $related_product = wc_get_product($related_id);
        if ($related_product && $related_product->get_type() === 'simple' && 
            $related_product->is_visible() && $related_product->is_purchasable()) {
            
            $related_sku = $related_product->get_sku();
            $related_slug = $related_product->get_slug();
            $related_name = $related_product->get_name();
            
            $related_regular_price = $related_product->get_regular_price();
            $related_sale_price = $related_product->get_sale_price();
            
            $related_image_id = $related_product->get_image_id();
            $related_image_url = null;
            if ($related_image_id) {
                $related_image_url = wp_get_attachment_image_url($related_image_id, 'woocommerce_thumbnail');
                // Fix URL to use correct domain
                $related_image_url = fix_image_url($related_image_url);
            }
            
            $related_gallery_ids = $related_product->get_gallery_image_ids();
            $related_gallery_images = array();
            foreach ($related_gallery_ids as $gallery_id) {
                $gallery_url = wp_get_attachment_image_url($gallery_id, 'woocommerce_thumbnail');
                // Fix URL to use correct domain
                $gallery_url = fix_image_url($gallery_url);
                if ($gallery_url) {
                    $related_gallery_images[] = array('sourceUrl' => $gallery_url);
                }
            }
            
            $related_pa_style = array();
            $related_attributes = $related_product->get_attribute('pa_style');
            if ($related_attributes) {
                $related_style_terms = explode(', ', $related_attributes);
                foreach ($related_style_terms as $term_name) {
                    $related_pa_style[] = array('name' => trim($term_name));
                }
            }
            
            $related_products[] = array(
                'sku' => $related_sku,
                'slug' => $related_slug,
                'name' => $related_name,
                'regularPrice' => $related_regular_price,
                'salePrice' => $related_sale_price ? $related_sale_price : null,
                'allPaStyle' => array('nodes' => $related_pa_style),
                'image' => $related_image_url ? array('sourceUrl' => $related_image_url) : null,
                'galleryImages' => array('nodes' => $related_gallery_images),
            );
        }
    }
    
    // Build response in GraphQL-like format
    $response = array(
        'product' => array(
            'databaseId' => $product_id,
            'sku' => $product_sku,
            'slug' => $product_slug,
            'name' => $product_name,
            'description' => $product_description,
            'regularPrice' => $regular_price,
            'salePrice' => $sale_price ? $sale_price : null,
            'stockQuantity' => $stock_quantity,
            'stockStatus' => strtoupper($stock_status),
            'status' => $product_status,
            'image' => $image_url ? array('sourceUrl' => $image_url) : null,
            'galleryImages' => array('nodes' => $gallery_images),
            'allPaColor' => array('nodes' => $pa_color),
            'allPaStyle' => array('nodes' => $pa_style),
            'related' => array('nodes' => $related_products),
            // Simple products don't have variations
            'variations' => array('nodes' => array()),
        )
    );
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
    error_log('[getProduct] Error: ' . $e->getMessage());
}

