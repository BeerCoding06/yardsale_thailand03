<?php
/**
 * User Login using WordPress wp_signon() - Direct Database Authentication
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string }
 * 
 * Supports both username and email login
 * Authenticates directly against WordPress database
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Load WordPress core
$wpLoadPath = '/var/www/html/wp-load.php';
if (!file_exists($wpLoadPath)) {
    error_log('[login] WordPress wp-load.php not found at: ' . $wpLoadPath);
    sendErrorResponse('WordPress core not found', 500);
}

require_once $wpLoadPath;

// Verify WordPress functions are available
if (!function_exists('wp_signon')) {
    error_log('[login] WordPress core not loaded properly - wp_signon() not found');
    sendErrorResponse('WordPress core not loaded properly', 500);
}

if (!function_exists('get_user_by')) {
    error_log('[login] WordPress core not loaded properly - get_user_by() not found');
    sendErrorResponse('WordPress core not loaded properly', 500);
}

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[login] Request body length: ' . strlen($input));

$body = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[login] JSON decode error: ' . json_last_error_msg());
    error_log('[login] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$body || empty($body['username']) || empty($body['password'])) {
    error_log('[login] Error: Missing credentials');
    sendErrorResponse('Missing credentials', 400);
}

$usernameOrEmail = trim($body['username']);
$password = $body['password'];

error_log('[login] Attempting login for: ' . $usernameOrEmail);

// Determine if input is email or username
$isEmail = filter_var($usernameOrEmail, FILTER_VALIDATE_EMAIL);
$userLogin = $usernameOrEmail;

// If email provided, find the actual username
if ($isEmail) {
    error_log('[login] Email detected, looking up username for: ' . $usernameOrEmail);
    $user = get_user_by('email', $usernameOrEmail);
    if ($user) {
        $userLogin = $user->user_login;
        error_log('[login] Found username: ' . $userLogin . ' for email: ' . $usernameOrEmail);
    } else {
        error_log('[login] No user found with email: ' . $usernameOrEmail);
        sendErrorResponse('Invalid username or password', 401);
    }
} else {
    // Verify username exists
    $user = get_user_by('login', $usernameOrEmail);
    if (!$user) {
        error_log('[login] No user found with username: ' . $usernameOrEmail);
        sendErrorResponse('Invalid username or password', 401);
    }
}

// Prepare credentials for wp_signon()
$credentials = [
    'user_login' => $userLogin,
    'user_password' => $password,
    'remember' => false
];

error_log('[login] Calling wp_signon() for user_login: ' . $userLogin);

// Use wp_signon() to authenticate against WordPress database
/** @var WP_User|WP_Error $user */
$user = wp_signon($credentials, false);

if (is_wp_error($user)) {
    /** @var WP_Error $user */
    $errorCode = $user->get_error_code();
    $errorMessage = $user->get_error_message();
    error_log('[login] wp_signon() failed - Code: ' . $errorCode . ', Message: ' . $errorMessage);
    
    // Provide user-friendly error messages
    $userFriendlyMessage = 'Invalid username or password';
    if ($errorCode === 'incorrect_password') {
        $userFriendlyMessage = 'Incorrect password';
    } elseif ($errorCode === 'invalid_username') {
        $userFriendlyMessage = 'Invalid username or email';
    }
    
    sendErrorResponse($userFriendlyMessage, 401);
}

// Login successful, get user data
/** @var WP_User $user */
error_log('[login] Login successful for user ID: ' . $user->ID . ', username: ' . $user->user_login);

sendJsonResponse([
    'success' => true,
    'user' => [
        'id' => $user->ID,
        'username' => $user->user_login,
        'email' => $user->user_email,
        'name' => $user->display_name ?: $user->user_login,
        'roles' => $user->roles
    ]
]);

exit;

?>
