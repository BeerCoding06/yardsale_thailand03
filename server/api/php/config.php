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

/**
 * Build WooCommerce API URL
 * 
 * @param string $endpoint API endpoint (e.g., 'wc/v3/products', 'wc/v3/orders')
 * @param array $params Query parameters
 * @return string Full API URL
 */
function buildWcApiUrl($endpoint, $params = []) {
    $baseUrl = rtrim(WC_BASE_URL, '/');
    $url = $baseUrl . '/wp-json/' . $endpoint;
    
    // Add credentials to params
    $params['consumer_key'] = WC_CONSUMER_KEY;
    $params['consumer_secret'] = WC_CONSUMER_SECRET;
    
    // Build query string
    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }
    
    return $url;
}

/**
 * Fetch data from WooCommerce API using cURL
 * 
 * @param string $url API URL
 * @param string $method HTTP method (GET, POST, PUT, DELETE)
 * @param array $data Request body data (for POST/PUT)
 * @return array Response data or error
 */
function fetchWooCommerceApi($url, $method = 'GET', $data = null) {
    $ch = curl_init();
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    if ($data && in_array($method, ['POST', 'PUT'])) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    curl_close($ch);
    
    if ($error) {
        return [
            'success' => false,
            'error' => $error,
            'http_code' => 0
        ];
    }
    
    $decoded = json_decode($response, true);
    
    return [
        'success' => $http_code >= 200 && $http_code < 300,
        'data' => $decoded,
        'http_code' => $http_code,
        'raw_response' => $response
    ];
}

/**
 * Send JSON response
 */
function sendJsonResponse($data, $status_code = 200) {
    http_response_code($status_code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Send error response
 */
function sendErrorResponse($message, $status_code = 500) {
    sendJsonResponse([
        'success' => false,
        'error' => $message
    ], $status_code);
}

?>
