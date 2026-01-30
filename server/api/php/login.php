<?php
/**
 * User Login using WordPress wp_signon()
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string }
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[login] Request body length: ' . strlen($input));

$body = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[login] JSON decode error: ' . json_last_error_msg());
    error_log('[login] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!is_array($body)) {
    error_log('[login] Error: Request body is not an array/object');
    sendErrorResponse('Invalid request body format', 400);
}

$username = isset($body['username']) ? trim($body['username']) : null;
$password = isset($body['password']) ? $body['password'] : null;

error_log('[login] Attempting login for username: ' . ($username ?? 'null'));
error_log('[login] Password length: ' . strlen($password ?? ''));

if (!$username || !$password) {
    error_log('[login] Error: username or password is missing');
    sendErrorResponse('Username and password are required', 400);
}

// Load WordPress core
require_once '/var/www/html/wp-load.php';

if (!function_exists('wp_signon')) {
    error_log('[login] WordPress core not loaded properly');
    sendErrorResponse('WordPress core not loaded', 500);
}

// Prepare credentials for wp_signon()
$credentials = [
    'user_login' => $username,
    'user_password' => $password,
    'remember' => false
];

error_log('[login] Calling wp_signon() for user: ' . $username);

// Use wp_signon() to authenticate
/** @var WP_User|WP_Error $user */
$user = wp_signon($credentials, false);

/** @var bool $isError */
if (is_wp_error($user)) {
    /** @var WP_Error $user */
    $errorMessage = $user->get_error_message();
    error_log('[login] wp_signon() failed: ' . $errorMessage);
    sendErrorResponse($errorMessage, 401);
}

/** @var WP_User $user */

// Login successful, get user data
error_log('[login] Login successful for user ID: ' . $user->ID);

sendJsonResponse([
    'success' => true,
    'user' => [
        'id' => $user->ID,
        'username' => $user->user_login,
        'email' => $user->user_email,
        'name' => $user->display_name,
        'roles' => $user->roles
    ]
]);

exit;

?>
