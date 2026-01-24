<?php
// API for uploading user profile picture

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
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Load WordPress
$wp_load_path = __DIR__ . '/../../../wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wp-load.php';
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found.']);
    exit();
}
require_once($wp_load_path);

// Check if file was uploaded
if (!isset($_FILES['profile_picture']) || $_FILES['profile_picture']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error']);
    exit();
}

$user_id = isset($_POST['user_id']) ? intval($_POST['user_id']) : null;
$file = $_FILES['profile_picture'];

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit();
}

// Verify user exists
$user = get_user_by('ID', $user_id);
if (!$user) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit();
}

// Validate file type
$allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
$file_type = $file['type'];
if (!in_array($file_type, $allowed_types)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed']);
    exit();
}

// Validate file size (max 5MB)
$max_size = 5 * 1024 * 1024; // 5MB
if ($file['size'] > $max_size) {
    http_response_code(400);
    echo json_encode(['error' => 'File size exceeds 5MB limit']);
    exit();
}

try {
    // Include WordPress file upload functions
    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');
    require_once(ABSPATH . 'wp-admin/includes/media.php');

    // Upload file
    $upload = wp_handle_upload($file, ['test_form' => false]);

    if (isset($upload['error'])) {
        http_response_code(400);
        echo json_encode(['error' => $upload['error']]);
        exit();
    }

    // Create attachment
    $attachment = [
        'post_mime_type' => $upload['type'],
        'post_title' => sanitize_file_name(pathinfo($upload['file'], PATHINFO_FILENAME)),
        'post_content' => '',
        'post_status' => 'inherit'
    ];

    $attach_id = wp_insert_attachment($attachment, $upload['file']);

    if (is_wp_error($attach_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Failed to create attachment']);
        exit();
    }

    // Generate attachment metadata
    $attach_data = wp_generate_attachment_metadata($attach_id, $upload['file']);
    wp_update_attachment_metadata($attach_id, $attach_data);

    // Delete old profile picture if exists
    $old_avatar_id = get_user_meta($user_id, 'profile_picture_id', true);
    if ($old_avatar_id) {
        wp_delete_attachment($old_avatar_id, true);
    }

    // Save profile picture attachment ID
    update_user_meta($user_id, 'profile_picture_id', $attach_id);

    // Get image URLs
    $image_url = wp_get_attachment_image_url($attach_id, 'thumbnail');
    $full_image_url = wp_get_attachment_image_url($attach_id, 'full');

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Profile picture uploaded successfully',
        'image_url' => $image_url,
        'full_image_url' => $full_image_url,
        'attachment_id' => $attach_id
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to upload profile picture: ' . $e->getMessage();
    error_log('[uploadProfilePicture] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[uploadProfilePicture] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

