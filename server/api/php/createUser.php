<?php
/**
 * Create User using WordPress REST API
 * 
 * Endpoint: POST /server/api/php/createUser.php
 * Body: User data (username, email, password, etc.)
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[createUser] Request body length: ' . strlen($input));

$userData = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[createUser] JSON decode error: ' . json_last_error_msg());
    error_log('[createUser] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$userData) {
    error_log('[createUser] Error: userData is empty or invalid');
    sendErrorResponse('Invalid user data', 400);
}

$username = isset($userData['username']) ? trim($userData['username']) : null;
$email = isset($userData['email']) ? trim($userData['email']) : null;

if (!$username || !$email) {
    sendErrorResponse('username and email are required', 400);
}

error_log('[createUser] Creating user: ' . $username . ' (' . $email . ')');

// Check for duplicate email and username
$baseUrl = rtrim(WC_BASE_URL, '/');

// Check email
if ($email) {
    $checkEmailUrl = $baseUrl . '/wp-json/wp/v2/users?search=' . urlencode($email) . '&per_page=100';
    error_log('[createUser] Checking email: ' . $checkEmailUrl);
    
    $checkEmailResult = fetchWordPressApi($checkEmailUrl, 'GET');
    
    if ($checkEmailResult['success'] && is_array($checkEmailResult['data'])) {
        foreach ($checkEmailResult['data'] as $user) {
            if (!empty($user['email']) && strtolower(trim($user['email'])) === strtolower($email)) {
                error_log('[createUser] Email already exists: ' . $email);
                sendErrorResponse('อีเมลนี้ถูกใช้งานแล้วในระบบ', 409);
            }
        }
    }
}

// Check username
if ($username) {
    $checkUsernameUrl = $baseUrl . '/wp-json/wp/v2/users?search=' . urlencode($username) . '&per_page=100';
    error_log('[createUser] Checking username: ' . $checkUsernameUrl);
    
    $checkUsernameResult = fetchWordPressApi($checkUsernameUrl, 'GET');
    
    if ($checkUsernameResult['success'] && is_array($checkUsernameResult['data'])) {
        foreach ($checkUsernameResult['data'] as $user) {
            if (!empty($user['username']) && strtolower(trim($user['username'])) === strtolower($username)) {
                error_log('[createUser] Username already exists: ' . $username);
                sendErrorResponse('ชื่อผู้ใช้นี้ถูกใช้งานแล้วในระบบ', 409);
            }
        }
    }
}

// Create user via WordPress REST API
$usersUrl = $baseUrl . '/wp-json/wp/v2/users';

error_log('[createUser] Creating user via WordPress API: ' . $usersUrl);

$result = fetchWordPressApi($usersUrl, 'POST', $userData);

if (!$result['success']) {
    $errorMessage = 'Failed to create user';
    $statusCode = $result['http_code'] ?: 500;
    
    if (!empty($result['data']['message'])) {
        $errorMessage = $result['data']['message'];
    } elseif (!empty($result['data']['code'])) {
        $errorCode = $result['data']['code'];
        
        // Map WordPress error codes to user-friendly messages
        if ($errorCode === 'existing_user_email' || $errorCode === 'email_exists') {
            $errorMessage = 'อีเมลนี้ถูกใช้งานแล้วในระบบ';
            $statusCode = 409;
        } elseif ($errorCode === 'rest_user_invalid_password') {
            $errorMessage = 'รหัสผ่านไม่ถูกต้อง หรือไม่ปลอดภัย กรุณากรอกใหม่อีกครั้ง';
            $statusCode = 400;
        } elseif ($errorCode === 'rest_invalid_param' || $errorCode === 'invalid_param') {
            $errorMessage = 'ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบข้อมูล';
            $statusCode = 400;
        }
    } elseif (!empty($result['error'])) {
        $errorMessage = $result['error'];
    }
    
    error_log('[createUser] Error: ' . $errorMessage . ' (HTTP ' . $statusCode . ')');
    sendErrorResponse($errorMessage, $statusCode);
}

error_log('[createUser] Successfully created user ID: ' . ($result['data']['id'] ?? 'N/A'));

// Remove sensitive data
unset($result['data']['password']);
unset($result['data']['user_pass']);

// Return response
sendJsonResponse($result['data']);

?>
