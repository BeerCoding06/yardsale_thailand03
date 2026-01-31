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
error_log('[login] Loading WordPress from: ' . $wp_load_path);
require_once($wp_load_path);

// Verify WordPress loaded correctly
if (!defined('ABSPATH')) {
    error_log('[login] ERROR: ABSPATH not defined after loading WordPress');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'WordPress failed to load correctly'
    ]);
    exit();
}

error_log('[login] WordPress loaded successfully. ABSPATH: ' . ABSPATH);

// Load pluggable functions (required for sanitize_text_field, wp_authenticate, etc.)
// This ensures functions are available even in CLI mode
$pluggable_path = ABSPATH . 'wp-includes/pluggable.php';
if (file_exists($pluggable_path)) {
    /** @var string ABSPATH */
    require_once $pluggable_path;
    error_log('[login] Pluggable functions loaded');
} else {
    error_log('[login] WARNING: pluggable.php not found at: ' . $pluggable_path);
}

// Verify WordPress functions are available
if (!function_exists('wp_authenticate')) {
    error_log('[login] ERROR: wp_authenticate() function not available');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'WordPress authentication functions not available'
    ]);
    exit();
}

error_log('[login] WordPress functions verified');

// Get request body (CLI + Web safe)
// CLI: read from REQUEST_BODY environment variable (set by php-executor.ts)
// Web: read from php://input
$input = getenv('REQUEST_BODY') ?: file_get_contents('php://input');
error_log('[login] Request body length: ' . strlen($input));
error_log('[login] Request body (first 100 chars): ' . substr($input, 0, 100));

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
error_log('[login] Password length: ' . strlen($password));
error_log('[login] Remember: ' . ($remember ? 'true' : 'false'));

// Authenticate user using WordPress core function
error_log('[login] Calling wp_authenticate()...');
/** @var WP_User|WP_Error $user */
$user = wp_authenticate($username, $password);

if (is_wp_error($user)) {
    $error_code = $user->get_error_code();
    $error_message = $user->get_error_message();
    error_log('[login] Authentication failed');
    error_log('[login] Error code: ' . $error_code);
    error_log('[login] Error message: ' . $error_message);
    error_log('[login] Error data: ' . json_encode($user->get_error_data()));
    
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid username or password',
        'message' => $error_message,
        'code' => $error_code
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
