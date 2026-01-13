<?php
// API for changing user password

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
$wp_load_path = __DIR__ . '/../../../wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = __DIR__ . '/../../../../wordpress/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    http_response_code(500);
    echo json_encode(['error' => 'WordPress wp-load.php not found.']);
    exit();
}
require_once($wp_load_path);

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$user_id = isset($input['user_id']) ? intval($input['user_id']) : null;
$current_password = isset($input['current_password']) ? $input['current_password'] : '';
$new_password = isset($input['new_password']) ? $input['new_password'] : '';
$confirm_password = isset($input['confirm_password']) ? $input['confirm_password'] : '';

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
    exit();
}

if (empty($current_password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Current password is required']);
    exit();
}

if (empty($new_password)) {
    http_response_code(400);
    echo json_encode(['error' => 'New password is required']);
    exit();
}

if ($new_password !== $confirm_password) {
    http_response_code(400);
    echo json_encode(['error' => 'New password and confirm password do not match']);
    exit();
}

if (strlen($new_password) < 6) {
    http_response_code(400);
    echo json_encode(['error' => 'New password must be at least 6 characters']);
    exit();
}

try {
    // Verify user exists
    $user = get_user_by('ID', $user_id);
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit();
    }

    // Verify current password
    if (!wp_check_password($current_password, $user->user_pass, $user_id)) {
        http_response_code(401);
        echo json_encode(['error' => 'Current password is incorrect']);
        exit();
    }

    // Update password
    wp_set_password($new_password, $user_id);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Password changed successfully'
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to change password: ' . $e->getMessage();
    error_log('[changePassword] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[changePassword] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

