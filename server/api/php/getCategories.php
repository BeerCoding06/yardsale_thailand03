<?php
// API for fetching WooCommerce product categories

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Load WordPress
// WordPress is at root level, try multiple paths
$wp_load_paths = [
    __DIR__ . '/../../../wp-load.php',  // From server/api/php/ to root
    __DIR__ . '/../../../../wp-load.php', // Alternative path
    __DIR__ . '/../../../wordpress/wp-load.php', // Fallback: wordpress folder
    '/app/wp-load.php', // Docker container path
];

$wp_load_path = null;
foreach ($wp_load_paths as $path) {
    if (file_exists($path)) {
        $wp_load_path = $path;
        break;
    }
}

if (!$wp_load_path) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress not found', 'tried_paths' => $wp_load_paths]);
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
    $parent = isset($_GET['parent']) ? intval($_GET['parent']) : 0;
    $hide_empty = isset($_GET['hide_empty']) ? filter_var($_GET['hide_empty'], FILTER_VALIDATE_BOOLEAN) : true;
    $orderby = isset($_GET['orderby']) ? sanitize_text_field($_GET['orderby']) : 'name';
    $order = isset($_GET['order']) ? strtoupper(sanitize_text_field($_GET['order'])) : 'ASC';
    
    // Validate order
    if (!in_array($order, ['ASC', 'DESC'])) {
        $order = 'ASC';
    }
    
    // Validate orderby
    $allowed_orderby = ['name', 'count', 'id', 'slug', 'term_group', 'none'];
    if (!in_array($orderby, $allowed_orderby)) {
        $orderby = 'name';
    }
    
    // Get categories
    $args = array(
        'taxonomy'   => 'product_cat',
        'hide_empty' => $hide_empty,
        'parent'     => $parent,
        'orderby'    => $orderby,
        'order'      => $order,
    );
    
    $categories = get_terms($args);
    
    if (is_wp_error($categories)) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to fetch categories',
            'message' => $categories->get_error_message()
        ]);
        exit();
    }
    
    // Format response
    $formatted_categories = array();
    
    foreach ($categories as $category) {
        // Get category image
        $image_id = get_term_meta($category->term_id, 'thumbnail_id', true);
        $image_url = null;
        
        if ($image_id) {
            $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
            if (!$image_url) {
                $image_url = wp_get_attachment_image_url($image_id, 'full');
            }
            // Fix URL to use correct domain
            $image_url = fix_image_url($image_url);
        }
        
        // Get product count (only products in stock)
        $product_count = 0;
        $products_query = new WP_Query(array(
            'post_type' => 'product',
            'posts_per_page' => 1,
            'tax_query' => array(
                array(
                    'taxonomy' => 'product_cat',
                    'field' => 'term_id',
                    'terms' => $category->term_id,
                ),
            ),
            'meta_query' => array(
                array(
                    'key' => '_stock_status',
                    'value' => 'instock',
                    'compare' => '=',
                ),
            ),
        ));
        
        if ($products_query->have_posts()) {
            $product_count = 1; // Just check if has products
        }
        
        // Get children count
        $children = get_terms(array(
            'taxonomy' => 'product_cat',
            'hide_empty' => false,
            'parent' => $category->term_id,
        ));
        
        $children_count = is_wp_error($children) ? 0 : count($children);
        
        // Get parent category info
        $parent_info = null;
        if ($category->parent > 0) {
            $parent_term = get_term($category->parent, 'product_cat');
            if ($parent_term && !is_wp_error($parent_term)) {
                $parent_image_id = get_term_meta($parent_term->term_id, 'thumbnail_id', true);
                $parent_image_url = null;
                
                if ($parent_image_id) {
                    $parent_image_url = wp_get_attachment_image_url($parent_image_id, 'woocommerce_thumbnail');
                    if (!$parent_image_url) {
                        $parent_image_url = wp_get_attachment_image_url($parent_image_id, 'full');
                    }
                    // Fix URL to use correct domain
                    $parent_image_url = fix_image_url($parent_image_url);
                }
                
                $parent_info = array(
                    'id' => $parent_term->term_id,
                    'name' => $parent_term->name,
                    'image' => $parent_image_url ? array('sourceUrl' => $parent_image_url) : null,
                );
            }
        }
        
        // Get children categories
        $children_categories = array();
        if ($children_count > 0) {
            foreach ($children as $child) {
                $child_image_id = get_term_meta($child->term_id, 'thumbnail_id', true);
                $child_image_url = null;
                
                if ($child_image_id) {
                    $child_image_url = wp_get_attachment_image_url($child_image_id, 'woocommerce_thumbnail');
                    if (!$child_image_url) {
                        $child_image_url = wp_get_attachment_image_url($child_image_id, 'full');
                    }
                    // Fix URL to use correct domain
                    $child_image_url = fix_image_url($child_image_url);
                }
                
                // Check if child has products
                $child_products_query = new WP_Query(array(
                    'post_type' => 'product',
                    'posts_per_page' => 1,
                    'tax_query' => array(
                        array(
                            'taxonomy' => 'product_cat',
                            'field' => 'term_id',
                            'terms' => $child->term_id,
                        ),
                    ),
                    'meta_query' => array(
                        array(
                            'key' => '_stock_status',
                            'value' => 'instock',
                            'compare' => '=',
                        ),
                    ),
                ));
                
                $has_products = $child_products_query->have_posts();
                
                $children_categories[] = array(
                    'id' => $child->term_id,
                    'name' => $child->name,
                    'image' => $child_image_url ? array('sourceUrl' => $child_image_url) : null,
                    'parent' => array(
                        'node' => array(
                            'id' => $category->term_id,
                            'name' => $category->name,
                            'image' => $image_url ? array('sourceUrl' => $image_url) : null,
                        )
                    ),
                    'products' => array(
                        'nodes' => $has_products ? array(array('id' => '1')) : array()
                    ),
                );
            }
        }
        
        $formatted_categories[] = array(
            'id' => $category->term_id,
            'name' => $category->name,
            'image' => $image_url ? array('sourceUrl' => $image_url) : null,
            'parent' => $parent_info ? array('node' => $parent_info) : null,
            'products' => array(
                'nodes' => $product_count > 0 ? array(array('id' => '1')) : array()
            ),
            'children' => array(
                'nodes' => $children_categories
            ),
        );
    }
    
    // Return response in GraphQL-like format
    echo json_encode(array(
        'productCategories' => array(
            'nodes' => $formatted_categories
        )
    ));
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
    error_log('[getCategories] Error: ' . $e->getMessage());
}

