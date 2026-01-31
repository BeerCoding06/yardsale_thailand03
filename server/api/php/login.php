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

// Authenticate using WordPress REST API
// WordPress is in a separate container, so we use REST API like other scripts
$wpBaseUrl = getenv('WP_BASE_URL') ?: 'http://157.85.98.150:8080';
$apiUrl = rtrim($wpBaseUrl, '/') . '/wp-json/wp/v2/users/me';

error_log('[login] Authenticating via WordPress REST API: ' . $apiUrl);

$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
curl_setopt($ch, CURLOPT_USERPWD, $username . ':' . $password);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    error_log('[login] cURL error: ' . $curlError);
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to connect to WordPress: ' . $curlError
    ]);
    exit();
}

error_log('[login] WordPress REST API response code: ' . $httpCode);

if ($httpCode !== 200) {
    $errorData = json_decode($response, true);
    $errorMessage = $errorData['message'] ?? 'Invalid username or password';
    error_log('[login] Authentication failed: ' . $errorMessage);
    
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid username or password',
        'message' => $errorMessage
    ]);
    exit();
}

// Authentication successful, parse user data
$userData = json_decode($response, true);
if (!$userData || !isset($userData['id'])) {
    error_log('[login] Invalid user data from WordPress API');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid response from WordPress API'
    ]);
    exit();
}

error_log('[login] Authentication successful for user ID: ' . $userData['id']);

// Get additional user data (profile picture, etc.)
$profile_picture_id = isset($userData['meta']['profile_picture_id']) ? $userData['meta']['profile_picture_id'] : null;
$profile_picture_url = null;
if ($profile_picture_id) {
    // Try to get profile picture URL from WordPress
    $mediaUrl = rtrim($wpBaseUrl, '/') . '/wp-json/wp/v2/media/' . $profile_picture_id;
    $mediaCh = curl_init($mediaUrl);
    curl_setopt($mediaCh, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($mediaCh, CURLOPT_TIMEOUT, 5);
    $mediaResponse = curl_exec($mediaCh);
    $mediaCode = curl_getinfo($mediaCh, CURLINFO_HTTP_CODE);
    curl_close($mediaCh);
    
    if ($mediaCode === 200) {
        $mediaData = json_decode($mediaResponse, true);
        if ($mediaData && isset($mediaData['source_url'])) {
            $profile_picture_url = $mediaData['source_url'];
        }
    }
}

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
