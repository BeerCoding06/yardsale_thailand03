<?php
/**
 * User Login using WordPress REST API
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

// Remove spaces from password (Application Passwords may have spaces)
if ($password) {
    $password = str_replace(' ', '', $password);
}

error_log('[login] Attempting login for username: ' . ($username ?? 'null'));
error_log('[login] Password length: ' . strlen($password ?? ''));

if (!$username || !$password) {
    error_log('[login] Error: username or password is missing');
    sendErrorResponse('Username and password are required', 400);
}

// Use WordPress REST API to verify credentials
// We'll use Basic Auth with username:password to authenticate
$baseUrl = rtrim(WC_BASE_URL, '/');
$meUrl = $baseUrl . '/wp-json/wp/v2/users/me';

error_log('[login] Authenticating via WordPress REST API: ' . $meUrl);
error_log('[login] Base URL: ' . $baseUrl);
error_log('[login] Username/Email: ' . $username);

// WordPress REST API /users/me endpoint requires Basic Auth
// Note: WordPress REST API may require Application Password instead of regular password
// Format: username:application_password or email:application_password

// First, try to find the actual username if email is provided
$actualUsername = $username;
$isEmail = filter_var($username, FILTER_VALIDATE_EMAIL);

if ($isEmail) {
    error_log('[login] Username appears to be an email, searching for actual username...');
    
    // Search for user by email using admin credentials
    $searchUrl = $baseUrl . '/wp-json/wp/v2/users?search=' . urlencode($username) . '&per_page=100';
    
    $wpBasicAuth = getWpBasicAuth();
    if ($wpBasicAuth) {
        $searchCh = curl_init();
        curl_setopt($searchCh, CURLOPT_URL, $searchUrl);
        curl_setopt($searchCh, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($searchCh, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Basic ' . $wpBasicAuth
        ]);
        curl_setopt($searchCh, CURLOPT_TIMEOUT, 10);
        curl_setopt($searchCh, CURLOPT_SSL_VERIFYPEER, false);
        
        $searchResponse = curl_exec($searchCh);
        $searchHttpCode = curl_getinfo($searchCh, CURLINFO_HTTP_CODE);
        curl_close($searchCh);
        
        if ($searchHttpCode === 200) {
            $users = json_decode($searchResponse, true);
            if (is_array($users) && !empty($users)) {
                // Find user with matching email
                foreach ($users as $user) {
                    if (isset($user['email']) && strtolower(trim($user['email'])) === strtolower($username)) {
                        $actualUsername = $user['username'] ?? $username;
                        error_log('[login] Found user with username: ' . $actualUsername . ' (email: ' . $user['email'] . ')');
                        break;
                    }
                }
            }
        } else {
            error_log('[login] Search request failed with HTTP ' . $searchHttpCode);
        }
    } else {
        error_log('[login] WP_BASIC_AUTH not configured, cannot search for username');
    }
}

// Use Basic Auth with username:password (or username:application_password)
$authString = $actualUsername . ':' . $password;

error_log('[login] Attempting login with: ' . $actualUsername . ' (original: ' . $username . ')');

// Use cURL with provided username:password for Basic Auth
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $meUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
// Use provided username:password for Basic Auth
curl_setopt($ch, CURLOPT_USERPWD, $authString);

// Enable verbose logging for debugging (only log to error_log, not output)
curl_setopt($ch, CURLOPT_VERBOSE, false);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
$curl_info = curl_getinfo($ch);
curl_close($ch);

if ($error) {
    error_log('[login] cURL error: ' . $error);
    sendErrorResponse('Failed to connect to WordPress: ' . $error, 500);
}

error_log('[login] WordPress API response HTTP code: ' . $http_code);
error_log('[login] cURL info: ' . json_encode([
    'url' => $curl_info['url'] ?? 'N/A',
    'http_code' => $http_code,
    'content_type' => $curl_info['content_type'] ?? 'N/A',
    'total_time' => $curl_info['total_time'] ?? 'N/A'
]));
error_log('[login] WordPress API response (first 500 chars): ' . substr($response, 0, 500));

// If login failed with 401, provide more detailed error message
if ($http_code === 401) {
    error_log('[login] Authentication failed (401)');
    error_log('[login] This may indicate:');
    error_log('[login] 1. Invalid username or password');
    error_log('[login] 2. WordPress requires Application Password instead of regular password');
    error_log('[login] 3. User account may be disabled or locked');
}

if ($http_code >= 200 && $http_code < 300) {
    $userData = json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('[login] JSON decode error: ' . json_last_error_msg());
        error_log('[login] Raw response: ' . substr($response, 0, 1000));
        sendErrorResponse('Invalid response from WordPress: ' . json_last_error_msg(), 500);
    }
    
    if (!is_array($userData) || empty($userData)) {
        error_log('[login] Invalid user data structure');
        sendErrorResponse('Invalid user data from WordPress', 500);
    }
    
    // Remove sensitive data
    unset($userData['password']);
    unset($userData['user_pass']);
    
    error_log('[login] Login successful for user ID: ' . ($userData['id'] ?? 'N/A'));
    
    sendJsonResponse([
        'success' => true,
        'user' => $userData,
        'message' => 'Login successful'
    ]);
} else {
    // Login failed - invalid credentials
    $errorData = json_decode($response, true);
    $errorMessage = 'Invalid username or password';
    
    if (is_array($errorData)) {
        if (isset($errorData['message'])) {
            $errorMessage = $errorData['message'];
        } elseif (isset($errorData['code'])) {
            $errorMessage = $errorData['code'];
        }
    } elseif (!empty($response)) {
        // If response is not JSON, use it as error message
        $errorMessage = substr($response, 0, 200);
    }
    
    error_log('[login] Login failed: ' . $errorMessage . ' (HTTP ' . $http_code . ')');
    error_log('[login] Full error response: ' . substr($response, 0, 1000));
    sendErrorResponse($errorMessage, 401);
}

?>
