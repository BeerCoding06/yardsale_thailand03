<?php
/**
 * User Login - WordPress REST API Authentication
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string, remember?: boolean }
 * 
 * Uses WordPress REST API with JWT Authentication plugin
 * This is the best approach because:
 * - WordPress handles password verification automatically
 * - No need to share filesystem between containers
 * - No need to access database directly
 * - Supports all WordPress hash formats
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

// Load config
require_once __DIR__ . '/config.php';

// Get request body (CLI + Web safe)
$input = getenv('REQUEST_BODY') ?: file_get_contents('php://input');
error_log('[login] Request body length: ' . strlen($input));

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

error_log('[login] Attempting login for: ' . $username);

// WordPress REST API endpoint for JWT Authentication
// WordPress container name: wp_app (or use WP_BASE_URL)
$wpBaseUrl = getenv('WP_BASE_URL') ?: 'http://wp_app:80';
$apiUrl = rtrim($wpBaseUrl, '/') . '/wp-json/jwt-auth/v1/token';

error_log('[login] Authenticating via WordPress REST API: ' . $apiUrl);

// Call WordPress REST API
$ch = curl_init($apiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'username' => $username,
    'password' => $password
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json'
]);
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

// Parse response
$responseData = json_decode($response, true);

if ($httpCode !== 200) {
    $errorMessage = $responseData['message'] ?? $responseData['code'] ?? 'Invalid username or password';
    error_log('[login] Authentication failed: ' . $errorMessage);
    
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid username or password',
        'message' => $errorMessage
    ]);
    exit();
}

// Authentication successful
if (!isset($responseData['user']) || !isset($responseData['token'])) {
    error_log('[login] Invalid response from WordPress API');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid response from WordPress API'
    ]);
    exit();
}

$wpUser = $responseData['user'];
$jwtToken = $responseData['token'];

error_log('[login] Authentication successful for user ID: ' . $wpUser['id']);

// Build user data response
$user_data = [
    'id' => $wpUser['id'],
    'username' => $wpUser['username'] ?? $wpUser['slug'] ?? '',
    'email' => $wpUser['email'] ?? '',
    'name' => $wpUser['name'] ?? $wpUser['display_name'] ?? '',
    'slug' => $wpUser['slug'] ?? '',
    'roles' => $wpUser['roles'] ?? ['subscriber'],
    'first_name' => $wpUser['first_name'] ?? '',
    'last_name' => $wpUser['last_name'] ?? '',
    'profile_picture_id' => null,
    'profile_picture_url' => null,
];

// Include JWT token if needed
if (isset($jwtToken)) {
    $user_data['token'] = $jwtToken;
}

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'user' => $user_data,
    'message' => 'Login successful'
]);
