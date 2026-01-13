<?php
// server/api/php/myProducts.php
// ดึงข้อมูล products ที่ผู้ใช้ลงขาย (post_author = user_id)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// รับ user_id จาก query parameter
$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;

if (!$user_id || $user_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required and must be greater than 0']);
    exit();
}

// โหลด WordPress
$wp_load_path = __DIR__ . '/../../../wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wordpress/wp-load.php'; // Fallback path
}

if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found']);
    exit();
}

require_once($wp_load_path);

// ตรวจสอบว่า WordPress โหลดสำเร็จ
if (!function_exists('get_posts')) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress functions not available']);
    exit();
}

// ดึง products ที่มี post_author = user_id
$args = [
    'post_type' => 'product',
    'post_status' => 'any', // ดึงทุก status (pending, publish, draft, etc.)
    'author' => $user_id,
    'posts_per_page' => -1, // ดึงทั้งหมด
    'orderby' => 'date',
    'order' => 'DESC',
];

$products = get_posts($args);

// เตรียมข้อมูล products
$products_data = [];

foreach ($products as $post) {
    // ดึงข้อมูล WooCommerce product
    $product = wc_get_product($post->ID);
    
    // Only fetch simple products
    if (!$product || $product->get_type() !== 'simple') {
        continue;
    }
    
    // ดึงข้อมูลรูปภาพ
    $image_id = $product->get_image_id();
    $image_url = '';
    if ($image_id) {
        $image_url = wp_get_attachment_image_url($image_id, 'woocommerce_thumbnail');
    }
    
    // ดึงข้อมูล gallery images
    $gallery_ids = $product->get_gallery_image_ids();
    $gallery = [];
    foreach ($gallery_ids as $gallery_id) {
        $gallery[] = wp_get_attachment_image_url($gallery_id, 'woocommerce_thumbnail');
    }
    
    // ดึงข้อมูล categories
    $categories = [];
    $category_terms = wp_get_post_terms($post->ID, 'product_cat');
    foreach ($category_terms as $term) {
        $categories[] = [
            'id' => $term->term_id,
            'name' => $term->name,
            'slug' => $term->slug,
        ];
    }
    
    // ดึงข้อมูล tags
    $tags = [];
    $tag_terms = wp_get_post_terms($post->ID, 'product_tag');
    foreach ($tag_terms as $term) {
        $tags[] = [
            'id' => $term->term_id,
            'name' => $term->name,
            'slug' => $term->slug,
        ];
    }
    
    $products_data[] = [
        'id' => $post->ID,
        'name' => $product->get_name(),
        'slug' => $post->post_name,
        'type' => $product->get_type(),
        'status' => $post->post_status,
        'regular_price' => $product->get_regular_price(),
        'sale_price' => $product->get_sale_price(),
        'price' => $product->get_price(),
        'description' => $post->post_content,
        'short_description' => $product->get_short_description(),
        'sku' => $product->get_sku(),
        'stock_status' => $product->get_stock_status(),
        'stock_quantity' => $product->get_stock_quantity(),
        'manage_stock' => $product->get_manage_stock(),
        'image' => $image_url,
        'gallery' => $gallery,
        'categories' => $categories,
        'tags' => $tags,
        'date_created' => $post->post_date,
        'date_modified' => $post->post_modified,
    ];
}

echo json_encode([
    'success' => true,
    'count' => count($products_data),
    'products' => $products_data,
], JSON_UNESCAPED_UNICODE);

