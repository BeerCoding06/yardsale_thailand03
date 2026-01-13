<?php
// server/api/php/login.php
// Handle user login to WordPress

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

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
// Path from server/api/php/login.php to wordpress/wp-load.php
$wp_load_path = __DIR__ . '/../../../wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    // Try alternative path
    $wp_load_path = __DIR__ . '/../../../../wordpress/wp-load.php';
    if (!file_exists($wp_load_path)) {
        http_response_code(500);
        echo json_encode(['error' => 'WordPress not found at: ' . $wp_load_path]);
        exit();
    }
}

require_once($wp_load_path);

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['username']) || !isset($input['password'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Username and password are required']);
    exit();
}

$username = sanitize_text_field($input['username']);
$password = $input['password'];
$remember = isset($input['remember']) ? (bool)$input['remember'] : false;

// Authenticate user
$user = wp_authenticate($username, $password);

if (is_wp_error($user)) {
    http_response_code(401);
    echo json_encode([
        'error' => 'Invalid username or password',
        'message' => $user->get_error_message()
    ]);
    exit();
}

// Login successful - set auth cookie
wp_set_auth_cookie($user->ID, $remember);

// Get user data
$profile_picture_id = get_user_meta($user->ID, 'profile_picture_id', true);
$profile_picture_url = '';
if ($profile_picture_id) {
    $profile_picture_url = wp_get_attachment_image_url($profile_picture_id, 'thumbnail');
    if (!$profile_picture_url) {
        $profile_picture_url = wp_get_attachment_image_url($profile_picture_id, 'full');
    }
}

$user_data = [
    'id' => $user->ID,
    'username' => $user->user_login,
    'email' => $user->user_email,
    'name' => $user->display_name,
    'slug' => $user->user_nicename,
    'roles' => $user->roles,
    'first_name' => get_user_meta($user->ID, 'first_name', true),
    'last_name' => get_user_meta($user->ID, 'last_name', true),
    'profile_picture_id' => $profile_picture_id ? intval($profile_picture_id) : null,
    'profile_picture_url' => $profile_picture_url,
];

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'user' => $user_data,
    'message' => 'Login successful'
]);

