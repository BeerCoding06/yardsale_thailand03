<?php
/**
 * Get Orders for logged-in user via WordPress custom endpoint with JWT authentication
 * 
 * Endpoint: GET /server/api/php/getMyOrders.php
 * Headers: Authorization: Bearer {JWT_TOKEN}
 * 
 * This endpoint:
 * 1. Extracts JWT token from Authorization header
 * 2. Calls WordPress custom endpoint /wp-json/yardsale/v1/my-orders
 * 3. WordPress endpoint validates JWT and returns orders for that user only
 */

require_once __DIR__ . '/config.php';

// Set CORS headers
setCorsHeaders();

// Get JWT token from Authorization header
// When running via CLI, headers are passed via environment variables
$authHeader = null;

// Try getallheaders() first (works in web server mode)
if (function_exists('getallheaders')) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
}

// Fallback: Check $_SERVER for HTTP_AUTHORIZATION (CLI mode)
if (!$authHeader) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
}

// Also check environment variable (set by php-executor.ts)
if (!$authHeader && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
}

if (!$authHeader) {
    error_log('[getMyOrders] No Authorization header found');
    sendErrorResponse('Authorization header is required. Please login first.', 401);
}

// Extract Bearer token
if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $jwtToken = trim($matches[1]);
} else {
    error_log('[getMyOrders] Invalid Authorization header format');
    sendErrorResponse('Invalid Authorization header format. Expected: Bearer {token}', 401);
}

if (empty($jwtToken)) {
    error_log('[getMyOrders] JWT token is empty');
    sendErrorResponse('JWT token is required', 401);
}

error_log('[getMyOrders] JWT token received (length: ' . strlen($jwtToken) . ')');

// Get query parameters
$status = isset($_GET['status']) ? $_GET['status'] : null;
$per_page = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 100;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;

// Build WordPress custom endpoint URL
$baseUrl = rtrim(WC_BASE_URL, '/');
$endpoint = '/wp-json/yardsale/v1/my-orders';

$params = [
    'per_page' => $per_page,
    'page' => $page
];

if ($status) {
    $params['status'] = $status;
}

$url = $baseUrl . $endpoint;
if (!empty($params)) {
    $url .= '?' . http_build_query($params);
}

error_log('[getMyOrders] Calling WordPress custom endpoint: ' . $url);

// Call WordPress custom endpoint with JWT token
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $jwtToken,
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 5);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    error_log('[getMyOrders] cURL error: ' . $curlError);
    sendErrorResponse('Failed to connect to WordPress API: ' . $curlError, 500);
}

error_log('[getMyOrders] WordPress API response - HTTP Code: ' . $httpCode);
error_log('[getMyOrders] WordPress API response (first 500 chars): ' . substr($response, 0, 500));

if ($httpCode !== 200) {
    $errorData = json_decode($response, true);
    $errorMessage = $errorData['message'] ?? $errorData['error'] ?? 'Failed to fetch orders';
    
    if ($httpCode === 401) {
        error_log('[getMyOrders] Authentication failed - JWT token invalid or expired');
        sendErrorResponse('Authentication failed. Please login again.', 401);
    } else {
        error_log('[getMyOrders] WordPress API error: ' . $errorMessage);
        sendErrorResponse($errorMessage, $httpCode);
    }
}

$data = json_decode($response, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[getMyOrders] JSON decode error: ' . json_last_error_msg());
    sendErrorResponse('Invalid response from WordPress API', 500);
}

// Return the response from WordPress custom endpoint
sendJsonResponse($data);

?>
