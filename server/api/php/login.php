<?php
/**
 * User Login - WordPress Authentication
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string, remember?: boolean }
 * 
 * Supports both username and email login
 * Uses WordPress core functions for authentication
 */

// Set CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Detect request method (CLI safe)
$method = $_SERVER['REQUEST_METHOD'] ?? 'POST';

if ($method === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

// WordPress path resolution (Docker first)
$possible_paths = [
    '/var/www/html/wp-load.php',  // 🔥 Docker production path (put FIRST)
    dirname(__DIR__, 4) . '/wp-load.php',  // Alternative: from server/api/php/ up 4 levels
    __DIR__ . '/../../../wordpress/wp-load.php',  // Local development: server/api/php/ -> wordpress/
    dirname(__DIR__, 3) . '/wordpress/wp-load.php',  // Alternative local path
];

$wp_load_path = null;
foreach ($possible_paths as $path) {
    if (file_exists($path)) {
        $wp_load_path = $path;
        error_log('[login] Found WordPress at: ' . $path);
        break;
    }
}

if (!$wp_load_path) {
    error_log('[login] WordPress not found. Tried paths: ' . implode(', ', $possible_paths));
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'WordPress not found. Please ensure WordPress is installed and accessible.'
    ]);
    exit();
}

// Load WordPress core
require_once($wp_load_path);

// Load pluggable functions (required for sanitize_text_field, wp_authenticate, etc.)
// This ensures functions are available even in CLI mode
// ABSPATH is defined by wp-load.php
if (defined('ABSPATH')) {
    /** @var string ABSPATH */
    require_once ABSPATH . 'wp-includes/pluggable.php';
}

// Get request body (CLI + Web safe)
// CLI: read from REQUEST_BODY environment variable (set by php-executor.ts)
// Web: read from php://input
$input = getenv('REQUEST_BODY') ?: file_get_contents('php://input');

// Parse JSON input
$body = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[login] JSON decode error: ' . json_last_error_msg());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON: ' . json_last_error_msg()
    ]);
    exit();
}

if (!isset($body['username']) || !isset($body['password'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Username and password are required'
    ]);
    exit();
}

/** @var string $username */
$username = sanitize_text_field($body['username']);
$password = $body['password'];
$remember = isset($body['remember']) ? (bool)$body['remember'] : false;

error_log('[login] Attempting login for: ' . $username);

// Authenticate user using WordPress core function
/** @var WP_User|WP_Error $user */
$user = wp_authenticate($username, $password);

if (is_wp_error($user)) {
    error_log('[login] Authentication failed: ' . $user->get_error_message());
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid username or password',
        'message' => $user->get_error_message()
    ]);
    exit();
}

error_log('[login] Authentication successful for user ID: ' . $user->ID);

// Get user meta data
$profile_picture_id = get_user_meta($user->ID, 'profile_picture_id', true);
$profile_picture_url = '';
if ($profile_picture_id) {
    $profile_picture_url = wp_get_attachment_image_url($profile_picture_id, 'thumbnail');
    if (!$profile_picture_url) {
        $profile_picture_url = wp_get_attachment_image_url($profile_picture_id, 'full');
    }
}

// Build user data response
$user_data = [
    'id' => $user->ID,
    'username' => $user->user_login,
    'email' => $user->user_email,
    'name' => $user->display_name,
    'slug' => $user->user_nicename,
    'roles' => $user->roles,
    'first_name' => get_user_meta($user->ID, 'first_name', true) ?: '',
    'last_name' => get_user_meta($user->ID, 'last_name', true) ?: '',
    'profile_picture_id' => $profile_picture_id ? intval($profile_picture_id) : null,
    'profile_picture_url' => $profile_picture_url ?: null,
];

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'user' => $user_data,
    'message' => 'Login successful'
]);
