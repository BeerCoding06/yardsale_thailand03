<?php
// API for updating user profile

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

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

$user_id = isset($input['user_id']) ? intval($input['user_id']) : null;
$first_name = isset($input['first_name']) ? sanitize_text_field($input['first_name']) : '';
$last_name = isset($input['last_name']) ? sanitize_text_field($input['last_name']) : '';
$display_name = isset($input['display_name']) ? sanitize_text_field($input['display_name']) : '';
$email = isset($input['email']) ? sanitize_email($input['email']) : '';

if (!$user_id) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id is required']);
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

    // Prepare user data
    $user_data = [
        'ID' => $user_id,
    ];

    if (!empty($first_name)) {
        $user_data['first_name'] = $first_name;
        update_user_meta($user_id, 'first_name', $first_name);
    }

    if (!empty($last_name)) {
        $user_data['last_name'] = $last_name;
        update_user_meta($user_id, 'last_name', $last_name);
    }

    if (!empty($display_name)) {
        $user_data['display_name'] = $display_name;
    }

    if (!empty($email) && is_email($email)) {
        // Check if email is already in use by another user
        $email_exists = email_exists($email);
        if ($email_exists && $email_exists !== $user_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Email already in use']);
            exit();
        }
        $user_data['user_email'] = $email;
    }

    // Update user
    $result = wp_update_user($user_data);

    if (is_wp_error($result)) {
        http_response_code(400);
        echo json_encode([
            'error' => $result->get_error_message(),
            'details' => $result->get_error_data()
        ]);
        exit();
    }

    // Get updated user data
    $updated_user = get_user_by('ID', $user_id);
    $user_data_response = [
        'id' => $updated_user->ID,
        'username' => $updated_user->user_login,
        'email' => $updated_user->user_email,
        'name' => $updated_user->display_name,
        'first_name' => get_user_meta($user_id, 'first_name', true),
        'last_name' => get_user_meta($user_id, 'last_name', true),
    ];

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully',
        'user' => $user_data_response
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    $error_message = 'Failed to update profile: ' . $e->getMessage();
    error_log('[updateProfile] Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    http_response_code(500);
    $error_message = 'PHP Error: ' . $e->getMessage();
    error_log('[updateProfile] PHP Error: ' . $error_message);
    echo json_encode([
        'error' => $error_message,
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
?>

