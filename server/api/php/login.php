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

// Load config for WordPress API functions
require_once __DIR__ . '/config.php';

// WordPress is in a separate container, so we'll use REST API for authentication
// This is the same approach used by other PHP scripts in this project
error_log('[login] Using WordPress REST API for authentication');

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

$username = trim($body['username']);
$password = $body['password'];
$remember = isset($body['remember']) ? (bool)$body['remember'] : false;

error_log('[login] Attempting login for: ' . $username);
error_log('[login] Password length: ' . strlen($password));

// Authenticate using WordPress wp-login.php endpoint
// This allows us to use regular username/password (not Application Password)
$wpBaseUrl = getenv('WP_BASE_URL') ?: 'http://157.85.98.150:8080';
$loginUrl = rtrim($wpBaseUrl, '/') . '/wp-login.php';

error_log('[login] Authenticating via WordPress login form: ' . $loginUrl);

// Step 1: Get login form to extract nonce/redirect_to
$ch = curl_init($loginUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_COOKIEJAR, '/tmp/wp_cookies_' . uniqid() . '.txt');
curl_setopt($ch, CURLOPT_COOKIEFILE, '/tmp/wp_cookies_' . uniqid() . '.txt');
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$loginPage = curl_exec($ch);
$cookieFile = curl_getinfo($ch, CURLINFO_COOKIELIST);
curl_close($ch);

// Step 2: Submit login form
$cookieFile = '/tmp/wp_cookies_' . uniqid() . '.txt';
$ch = curl_init($loginUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'log' => $username,
    'pwd' => $password,
    'rememberme' => $remember ? 'forever' : '',
    'wp-submit' => 'Log In',
    'redirect_to' => rtrim($wpBaseUrl, '/') . '/wp-admin/',
    'testcookie' => '1'
]));
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$loginResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$redirectUrl = curl_getinfo($ch, CURLINFO_REDIRECT_URL);
$curlError = curl_error($ch);
curl_close($ch);

// Clean up cookie file
if (file_exists($cookieFile)) {
    @unlink($cookieFile);
}

if ($curlError) {
    error_log('[login] cURL error: ' . $curlError);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to connect to WordPress: ' . $curlError
    ]);
    exit();
}

error_log('[login] WordPress login response code: ' . $httpCode);
error_log('[login] Redirect URL: ' . ($redirectUrl ?: 'none'));

// Check if login was successful (redirect to wp-admin means success)
if ($httpCode === 302 && $redirectUrl && strpos($redirectUrl, 'wp-admin') !== false) {
    // Login successful, now get user data via REST API with cookies
    error_log('[login] Login successful, fetching user data...');
    
    // Get user data using REST API (we'll use Application Password or try without auth)
    // Since we can't easily pass cookies, let's try to get user by email/username
    $usersUrl = rtrim($wpBaseUrl, '/') . '/wp-json/wp/v2/users?search=' . urlencode($username);
    
    $ch = curl_init($usersUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    
    $usersResponse = curl_exec($ch);
    $usersCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($usersCode === 200) {
        $usersData = json_decode($usersResponse, true);
        if ($usersData && is_array($usersData) && count($usersData) > 0) {
            $userData = $usersData[0];
            error_log('[login] Found user: ID=' . $userData['id']);
            
            // Build user data response
            $user_data = [
                'id' => $userData['id'],
                'username' => $userData['slug'] ?? $userData['name'] ?? '',
                'email' => $userData['email'] ?? '',
                'name' => $userData['name'] ?? '',
                'slug' => $userData['slug'] ?? '',
                'roles' => $userData['roles'] ?? ['subscriber'],
                'first_name' => $userData['meta']['first_name'] ?? '',
                'last_name' => $userData['meta']['last_name'] ?? '',
                'profile_picture_id' => null,
                'profile_picture_url' => null,
            ];
        } else {
            error_log('[login] User not found in REST API response');
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'Failed to retrieve user data'
            ]);
            exit();
        }
    } else {
        // If REST API fails, return basic user info
        error_log('[login] REST API failed, returning basic success');
        $user_data = [
            'id' => 0,
            'username' => $username,
            'email' => $username, // Assume email if username is email
            'name' => $username,
            'slug' => $username,
            'roles' => ['subscriber'],
            'first_name' => '',
            'last_name' => '',
            'profile_picture_id' => null,
            'profile_picture_url' => null,
        ];
    }
} else {
    // Login failed
    $errorMessage = 'Invalid username or password';
    if (strpos($loginResponse, 'incorrect') !== false || strpos($loginResponse, 'error') !== false) {
        $errorMessage = 'Invalid username or password';
    }
    error_log('[login] Authentication failed: ' . $errorMessage);
    
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid username or password',
        'message' => $errorMessage
    ]);
    exit();
}

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'user' => $user_data,
    'message' => 'Login successful'
]);
