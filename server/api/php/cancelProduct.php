<?php
// server/api/php/cancelProduct.php
// เปลี่ยนสถานะสินค้าเป็น draft (ไม่แสดงในหน้าร้าน, ไม่สามารถเพิ่มลงตะกร้าได้)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// รับข้อมูลจาก POST body
$input = json_decode(file_get_contents('php://input'), true);

$product_id = isset($input['product_id']) ? intval($input['product_id']) : null;
$user_id = isset($input['user_id']) ? intval($input['user_id']) : null;

if (!$product_id || $product_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'product_id is required and must be greater than 0']);
    exit();
}

if (!$user_id || $user_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required and must be greater than 0']);
    exit();
}

// โหลด WordPress
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wp-load.php'; // Fallback path
}

if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found']);
    exit();
}

require_once($wp_load_path);

// ตรวจสอบว่า WordPress โหลดสำเร็จ
if (!function_exists('get_post') || !function_exists('wp_update_post')) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress functions not available']);
    exit();
}

// ตรวจสอบว่า product มีอยู่จริงและเป็นของ user นี้
$post = get_post($product_id);

if (!$post || $post->post_type !== 'product') {
    http_response_code(404);
    echo json_encode(['error' => 'Product not found']);
    exit();
}

// ตรวจสอบว่า product เป็นของ user นี้
if ($post->post_author != $user_id) {
    http_response_code(403);
    echo json_encode(['error' => 'You do not have permission to cancel this product']);
    exit();
}

// เปลี่ยนสถานะเป็น draft (ไม่แสดงในหน้าร้าน, ไม่สามารถเพิ่มลงตะกร้าได้)
$update_result = wp_update_post([
    'ID' => $product_id,
    'post_status' => 'draft'
], true);

if (is_wp_error($update_result)) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to cancel product',
        'message' => $update_result->get_error_message()
    ]);
    exit();
}

// ดึงข้อมูล product ที่อัปเดตแล้ว
$updated_post = get_post($product_id);

echo json_encode([
    'success' => true,
    'message' => 'Product cancelled successfully',
    'product' => [
        'id' => $updated_post->ID,
        'name' => $updated_post->post_title,
        'status' => $updated_post->post_status,
    ]
], JSON_UNESCAPED_UNICODE);

