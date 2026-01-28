<?php
/**
 * WooCommerce API Configuration
 * 
 * This file contains configuration for WooCommerce REST API
 */

// WooCommerce API credentials
define('WC_BASE_URL', getenv('WP_BASE_URL') ?: 'http://157.85.98.150:8080');
define('WC_CONSUMER_KEY', getenv('WP_CONSUMER_KEY') ?: 'ck_c079fe80d163d7fd5d1f0bccfe2d198ece614ca4');
define('WC_CONSUMER_SECRET', getenv('WP_CONSUMER_SECRET') ?: 'cs_787ef53ac512d8cb7a80aec2bffd73476a317afe');

// WordPress Basic Auth (for WordPress REST API)
// Format 1: username:password (recommended - will be encoded automatically)
// Format 2: base64(username:password) (already encoded)
// Example: "paradon_pokpingmaung:W36JN6v85sOY5isnYh86hLLK"
// Example base64: echo -n "username:password" | base64
define('WP_BASIC_AUTH', getenv('WP_BASIC_AUTH') ?: '');

/**
 * Build WordPress REST API v2 URL
 * 
 * @param string $endpoint API endpoint (e.g., 'wp/v2/product', 'wp/v2/product_cat')
 * @param array $params Query parameters
 * @return string Full API URL
 */
function buildWpApiUrl($endpoint, $params = []) {
    $baseUrl = rtrim(WC_BASE_URL, '/');
    $url = $baseUrl . '/wp-json/' . $endpoint;
    
    // Build query string
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    return $url;
}

/**
 * Build WooCommerce API URL (deprecated - use buildWpApiUrl for wp/v2)
 * 
 * @param string $endpoint API endpoint (e.g., 'wc/v3/products', 'wc/v3/orders')
 * @param array $params Query parameters
 * @return string Full API URL
 */
function buildWcApiUrl($endpoint, $params = [], $useBasicAuth = false) {
    $baseUrl = rtrim(WC_BASE_URL, '/');
    
    // Remove leading/trailing slashes from endpoint
    $endpoint = trim($endpoint, '/');
    
    $url = $baseUrl . '/wp-json/' . $endpoint;
    
    // Add credentials to params (only if NOT using Basic Auth)
    // WooCommerce API can use either:
    // 1. consumer_key/consumer_secret in query params (legacy)
    // 2. Basic Auth (recommended, more secure)
    if (!$useBasicAuth) {
        if (!empty(WC_CONSUMER_KEY)) {
            $params['consumer_key'] = WC_CONSUMER_KEY;
        }
        if (!empty(WC_CONSUMER_SECRET)) {
            $params['consumer_secret'] = WC_CONSUMER_SECRET;
        }
    }
    
    // Build query string
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    // Remove trailing slash (WooCommerce API doesn't like trailing slashes)
    $url = rtrim($url, '/');
    
    return $url;
}

/**
 * Get WordPress Basic Auth credentials
 * Supports both username:password and base64 encoded formats
 * 
 * @return string|null Base64 encoded credentials or null
 */
function getWpBasicAuth() {
    if (empty(WP_BASIC_AUTH)) {
        return null;
    }
    
    // If it contains ':' it's username:password format, encode it
    if (strpos(WP_BASIC_AUTH, ':') !== false) {
        return base64_encode(WP_BASIC_AUTH);
    }
    
    // Otherwise assume it's already base64 encoded
    return WP_BASIC_AUTH;
}

/**
 * Get WordPress API headers with Basic Auth
 * 
 * @return array Headers array
 */
function getWpApiHeaders() {
    $headers = [
        'Content-Type: application/json'
    ];
    
    $basicAuth = getWpBasicAuth();
    if ($basicAuth) {
        $headers[] = 'Authorization: Basic ' . $basicAuth;
    }
    
    return $headers;
}

/**
 * Fetch data from WooCommerce API using cURL
 * 
 * @param string $url API URL
 * @param string $method HTTP method (GET, POST, PUT, DELETE)
 * @param array $data Request body data (for POST/PUT)
 * @param bool $useBasicAuth Use Basic Auth for WordPress REST API (default: false)
 * @return array Response data or error
 */
function fetchWooCommerceApi($url, $method = 'GET', $data = null, $useBasicAuth = false) {
    $ch = curl_init();
    
    $headers = ['Content-Type: application/json'];
    
    // Add Basic Auth using CURLOPT_USERPWD (more reliable than Authorization header)
    if ($useBasicAuth && !empty(WP_BASIC_AUTH)) {
        // If it contains ':' it's username:password format
        if (strpos(WP_BASIC_AUTH, ':') !== false) {
            curl_setopt($ch, CURLOPT_USERPWD, WP_BASIC_AUTH);
        } else {
            // Otherwise assume it's base64 encoded, decode it first
            $decoded = base64_decode(WP_BASIC_AUTH);
            if ($decoded !== false && strpos($decoded, ':') !== false) {
                curl_setopt($ch, CURLOPT_USERPWD, $decoded);
            } else {
                // Fallback: use Authorization header
                $basicAuth = getWpBasicAuth();
                if ($basicAuth) {
                    $headers[] = 'Authorization: Basic ' . $basicAuth;
                }
            }
        }
    }
    
    // Log the full URL for debugging (hide secret)
    $logUrl = preg_replace('/consumer_secret=[^&]+/', 'consumer_secret=***', $url);
    error_log('[fetchWooCommerceApi] Request: ' . $method . ' ' . $logUrl);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    
    if ($data && in_array($method, ['POST', 'PUT'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $curl_info = curl_getinfo($ch);
    
    curl_close($ch);
    
    if ($error) {
        error_log('[fetchWooCommerceApi] cURL error: ' . $error);
        error_log('[fetchWooCommerceApi] URL: ' . $logUrl);
        return [
            'success' => false,
            'error' => $error,
            'http_code' => 0,
            'raw_response' => $response
        ];
    }
    
    // Log response for debugging
    error_log('[fetchWooCommerceApi] Response HTTP ' . $http_code . ' (Content-Type: ' . ($curl_info['content_type'] ?? 'N/A') . ')');
    
    if ($http_code >= 400) {
        error_log('[fetchWooCommerceApi] HTTP ' . $http_code . ' error. Response: ' . substr($response, 0, 500));
    }
    
    $decoded = json_decode($response, true);
    
    // Check for JSON decode errors
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('[fetchWooCommerceApi] JSON decode error: ' . json_last_error_msg());
        error_log('[fetchWooCommerceApi] Response (first 500 chars): ' . substr($response, 0, 500));
    }
    
    // Log successful response info
    if ($http_code >= 200 && $http_code < 300) {
        if (is_array($decoded)) {
            error_log('[fetchWooCommerceApi] Success: Got ' . count($decoded) . ' items');
            if (count($decoded) > 0) {
                error_log('[fetchWooCommerceApi] First item keys: ' . implode(', ', array_keys($decoded[0])));
            }
        } else {
            error_log('[fetchWooCommerceApi] Success: Response is ' . gettype($decoded));
        }
    }
    
    return [
        'success' => $http_code >= 200 && $http_code < 300,
        'data' => $decoded,
        'http_code' => $http_code,
        'raw_response' => $response
    ];
}

/**
 * Fetch data from WordPress REST API using cURL (with Basic Auth)
 * 
 * @param string $url API URL
 * @param string $method HTTP method (GET, POST, PUT, DELETE)
 * @param array $data Request body data (for POST/PUT)
 * @return array Response data or error
 */
function fetchWordPressApi($url, $method = 'GET', $data = null) {
    return fetchWooCommerceApi($url, $method, $data, true);
}

/**
 * Set CORS headers
 */
function setCorsHeaders() {
    // Only set headers if not already sent
    if (headers_sent()) {
        return;
    }
    
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");
    header('Content-Type: application/json');
    
    // Handle preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

/**
 * Send JSON response
 */
function sendJsonResponse($data, $status_code = 200) {
    // CORS headers are already set by setCorsHeaders() if called separately
    // But we ensure they're set here too if not already sent
    if (!headers_sent()) {
        setCorsHeaders();
    }
    http_response_code($status_code);
    echo json_encode($data);
    exit;
}

/**
 * Send error response
 */
function sendErrorResponse($message, $status_code = 500) {
    // setCorsHeaders() will be called by sendJsonResponse()
    sendJsonResponse([
        'success' => false,
        'error' => $message
    ], $status_code);
}

?>
