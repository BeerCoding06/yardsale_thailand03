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

// Use wp_signon() to authenticate with WordPress
// This requires WordPress core to be loaded
$baseUrl = rtrim(WC_BASE_URL, '/');

error_log('[login] Base URL: ' . $baseUrl);
error_log('[login] Username/Email: ' . $username);

// Try to load WordPress core
// WordPress may be in a different location, so we'll try multiple paths
$wpLoadPaths = [
    $baseUrl . '/wp-load.php',  // Standard WordPress location
    '/var/www/html/wp-load.php', // Common Docker path
    '/app/wp-load.php',          // Alternative Docker path
    dirname(__DIR__) . '/../../wp-load.php', // Relative path
];

$wpLoaded = false;
$wpLoadPath = null;

foreach ($wpLoadPaths as $path) {
    // For remote paths, we'll need to use HTTP request
    if (strpos($path, 'http://') === 0 || strpos($path, 'https://') === 0) {
        // Can't directly require remote file, will use remote wp_signon instead
        break;
    }
    
    if (file_exists($path)) {
        error_log('[login] Found WordPress at: ' . $path);
        try {
            require_once $path;
            $wpLoaded = true;
            $wpLoadPath = $path;
            break;
        } catch (Exception $e) {
            error_log('[login] Failed to load WordPress from ' . $path . ': ' . $e->getMessage());
        }
    }
}

if (!$wpLoaded) {
    error_log('[login] WordPress core not found locally, using remote wp_signon via HTTP...');
    
    // Use remote WordPress login endpoint that uses wp_signon()
    // Create a custom WordPress endpoint or use existing login mechanism
    $loginEndpoint = $baseUrl . '/wp-login.php';
    
    // Try to authenticate via WordPress login form and get user data
    // We'll use wp_signon() logic via a custom endpoint or direct database check
    // For now, let's use a workaround: call WordPress REST API after login form
    
    // Step 1: Use login form to authenticate
    $loginUrl = $baseUrl . '/wp-login.php';
    $loginPostData = http_build_query([
        'log' => $username,
        'pwd' => $password,
        'wp-submit' => 'Log In',
        'redirect_to' => $baseUrl . '/wp-admin/',
        'testcookie' => '1'
    ]);
    
    $cookieFile = sys_get_temp_dir() . '/wp_login_cookies_' . uniqid() . '.txt';
    
    $loginCh = curl_init();
    curl_setopt($loginCh, CURLOPT_URL, $loginUrl);
    curl_setopt($loginCh, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($loginCh, CURLOPT_POST, true);
    curl_setopt($loginCh, CURLOPT_POSTFIELDS, $loginPostData);
    curl_setopt($loginCh, CURLOPT_HTTPHEADER, [
        'Content-Type: application/x-www-form-urlencoded',
        'User-Agent: Mozilla/5.0 (compatible; WordPress Login)'
    ]);
    curl_setopt($loginCh, CURLOPT_TIMEOUT, 30);
    curl_setopt($loginCh, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($loginCh, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($loginCh, CURLOPT_FOLLOWLOCATION, false);
    curl_setopt($loginCh, CURLOPT_COOKIEJAR, $cookieFile);
    curl_setopt($loginCh, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($loginCh, CURLOPT_HEADER, true);
    
    $loginResponse = curl_exec($loginCh);
    $loginHttpCode = curl_getinfo($loginCh, CURLINFO_HTTP_CODE);
    $loginHeaderSize = curl_getinfo($loginCh, CURLINFO_HEADER_SIZE);
    curl_close($loginCh);
    
    $loginHeaders = substr($loginResponse, 0, $loginHeaderSize);
    $loginBody = substr($loginResponse, $loginHeaderSize);
    
    // Check if login was successful (redirect indicates success)
    $loginSuccessful = ($loginHttpCode >= 300 && $loginHttpCode < 400) || 
                       strpos($loginBody, 'wp-admin') !== false ||
                       strpos($loginBody, 'dashboard') !== false;
    
    if (!$loginSuccessful) {
        // Check for error messages
        if (strpos($loginBody, 'incorrect password') !== false || 
            strpos($loginBody, 'Invalid username') !== false ||
            strpos($loginBody, 'ERROR') !== false) {
            error_log('[login] Login failed: Invalid credentials');
            if (file_exists($cookieFile)) {
                @unlink($cookieFile);
            }
            sendErrorResponse('Invalid username or password', 401);
        }
    }
    
    // Step 2: Get user data using REST API with cookies
    if ($loginSuccessful && file_exists($cookieFile)) {
        $meUrl = $baseUrl . '/wp-json/wp/v2/users/me';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $meUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        $curl_info = curl_getinfo($ch);
        curl_close($ch);
        
        @unlink($cookieFile);
        
        if ($http_code >= 200 && $http_code < 300) {
            $userData = json_decode($response, true);
            
            if (json_last_error() === JSON_ERROR_NONE && is_array($userData) && !empty($userData)) {
                unset($userData['password']);
                unset($userData['user_pass']);
                
                error_log('[login] Login successful for user ID: ' . ($userData['id'] ?? 'N/A'));
                
                sendJsonResponse([
                    'success' => true,
                    'user' => $userData,
                    'message' => 'Login successful'
                ]);
            }
        }
    }
    
    error_log('[login] Remote login failed');
    sendErrorResponse('Invalid username or password', 401);
}

// WordPress core is loaded locally, use wp_signon()
error_log('[login] WordPress core loaded, using wp_signon()...');

// Check if WordPress functions are available
if (function_exists('wp_signon')) {
    // Prepare credentials for wp_signon()
    $credentials = [
        'user_login' => $username,
        'user_password' => $password,
        'remember' => false
    ];
    
    // Use wp_signon() to authenticate
    /** @var WP_User|WP_Error $user */
    $user = wp_signon($credentials, false);
    
    /** @var bool $isError */
    if (is_wp_error($user)) {
        $errorMessage = $user->get_error_message();
        error_log('[login] wp_signon() failed: ' . $errorMessage);
        sendErrorResponse($errorMessage, 401);
    }
    
    // Login successful, get user data
    /** @var WP_User $user */
    $userData = [
        'id' => $user->ID,
        'username' => $user->user_login,
        'email' => $user->user_email,
        'name' => $user->display_name,
    ];
    
    // Add optional fields if functions exist
    if (function_exists('get_user_meta')) {
        /** @var string $firstName */
        $firstName = get_user_meta($user->ID, 'first_name', true);
        /** @var string $lastName */
        $lastName = get_user_meta($user->ID, 'last_name', true);
        $userData['first_name'] = $firstName;
        $userData['last_name'] = $lastName;
    }
    
    if (isset($user->roles)) {
        $userData['roles'] = $user->roles;
    }
    if (isset($user->allcaps)) {
        $userData['capabilities'] = $user->allcaps;
    }
    
    error_log('[login] Login successful for user ID: ' . $userData['id']);
    
    sendJsonResponse([
        'success' => true,
        'user' => $userData,
        'message' => 'Login successful'
    ]);
} else {
    error_log('[login] wp_signon() function not available, WordPress core may not be fully loaded');
    sendErrorResponse('WordPress core not properly loaded', 500);
}

// WordPress REST API /users/me endpoint requires Application Password for Basic Auth
// Regular password will NOT work with this endpoint directly
// We need to use WordPress login form to authenticate with regular password first
// Then use the session cookie to get user data

error_log('[login] Attempting login with regular password using WordPress login form...');
error_log('[login] Username: ' . $actualUsername . ' (original: ' . $username . ')');

// Step 1: Login via WordPress login form to get session cookie
$loginUrl = $baseUrl . '/wp-login.php';
$loginPostData = http_build_query([
    'log' => $actualUsername,
    'pwd' => $password,
    'wp-submit' => 'Log In',
    'redirect_to' => $baseUrl . '/wp-admin/',
    'testcookie' => '1'
]);

// Use temporary file for cookies
$cookieFile = sys_get_temp_dir() . '/wp_login_cookies_' . uniqid() . '.txt';

$loginCh = curl_init();
curl_setopt($loginCh, CURLOPT_URL, $loginUrl);
curl_setopt($loginCh, CURLOPT_RETURNTRANSFER, true);
curl_setopt($loginCh, CURLOPT_POST, true);
curl_setopt($loginCh, CURLOPT_POSTFIELDS, $loginPostData);
curl_setopt($loginCh, CURLOPT_HTTPHEADER, [
    'Content-Type: application/x-www-form-urlencoded',
    'User-Agent: Mozilla/5.0 (compatible; WordPress Login)'
]);
curl_setopt($loginCh, CURLOPT_TIMEOUT, 30);
curl_setopt($loginCh, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($loginCh, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($loginCh, CURLOPT_FOLLOWLOCATION, false); // Don't follow redirects, we want to check the response
curl_setopt($loginCh, CURLOPT_COOKIEJAR, $cookieFile); // Store cookies in file
curl_setopt($loginCh, CURLOPT_COOKIEFILE, $cookieFile); // Use cookies from file
curl_setopt($loginCh, CURLOPT_HEADER, true); // Include headers in response to extract cookies

$loginResponse = curl_exec($loginCh);
$loginHttpCode = curl_getinfo($loginCh, CURLINFO_HTTP_CODE);
$loginError = curl_error($loginCh);
$loginHeaderSize = curl_getinfo($loginCh, CURLINFO_HEADER_SIZE);
curl_close($loginCh);

// Extract response body and headers
$loginHeaders = substr($loginResponse, 0, $loginHeaderSize);
$loginBody = substr($loginResponse, $loginHeaderSize);

// Extract cookies from response headers
$cookies = [];
if (preg_match_all('/Set-Cookie: ([^;]+)/i', $loginHeaders, $matches)) {
    foreach ($matches[1] as $cookie) {
        $cookies[] = $cookie;
    }
}

error_log('[login] Login form response HTTP code: ' . $loginHttpCode);
error_log('[login] Found ' . count($cookies) . ' cookies');
if (!empty($cookies)) {
    error_log('[login] Cookies: ' . implode(', ', array_slice($cookies, 0, 3)) . '...');
}
error_log('[login] Login body preview (first 200 chars): ' . substr($loginBody, 0, 200));

// Check if login was successful (WordPress redirects on successful login)
// If we get a redirect (3xx) or the response contains admin dashboard, login was successful
$loginSuccessful = false;
if ($loginHttpCode >= 300 && $loginHttpCode < 400) {
    $loginSuccessful = true;
    error_log('[login] Login form returned redirect (likely successful)');
} elseif (strpos($loginBody, 'wp-admin') !== false || strpos($loginBody, 'dashboard') !== false || strpos($loginBody, 'wp-login.php?loggedout') !== false) {
    $loginSuccessful = true;
    error_log('[login] Login form response contains admin dashboard (likely successful)');
} elseif (strpos($loginBody, 'incorrect password') !== false || strpos($loginBody, 'Invalid username') !== false || strpos($loginBody, 'ERROR') !== false) {
    $loginSuccessful = false;
    error_log('[login] Login form indicates incorrect credentials');
    error_log('[login] Login body (first 500 chars): ' . substr($loginBody, 0, 500));
} else {
    // Try to get user data with cookies to verify
    error_log('[login] Login form response unclear, verifying with REST API...');
    error_log('[login] Login body (first 500 chars): ' . substr($loginBody, 0, 500));
}

// Step 2: If login was successful, get user data using REST API with cookies
// Always try to use cookies if we have them, even if login check was unclear
if ($loginSuccessful || !empty($cookies) || file_exists($cookieFile)) {
    error_log('[login] Attempting to get user data via REST API with session cookies...');
    error_log('[login] Cookie file exists: ' . (file_exists($cookieFile) ? 'yes' : 'no'));
    if (file_exists($cookieFile)) {
        error_log('[login] Cookie file size: ' . filesize($cookieFile) . ' bytes');
    }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $meUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile); // Use cookies from file
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $curl_info = curl_getinfo($ch);
    curl_close($ch);
    
    // If REST API with cookies works, we're done
    if ($http_code >= 200 && $http_code < 300) {
        error_log('[login] Successfully authenticated with regular password via login form');
        error_log('[login] REST API response (first 500 chars): ' . substr($response, 0, 500));
    } else {
        error_log('[login] REST API with cookies failed, HTTP code: ' . $http_code);
        error_log('[login] REST API response (first 500 chars): ' . substr($response, 0, 500));
        // Fallback: Try Application Password method
        error_log('[login] Cookie-based auth failed, trying Application Password method...');
        $authString = $actualUsername . ':' . $password;
        
        $ch2 = curl_init();
        curl_setopt($ch2, CURLOPT_URL, $meUrl);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch2, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch2, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch2, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch2, CURLOPT_USERPWD, $authString);
        
    $response = curl_exec($ch2);
    $http_code = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    $error = curl_error($ch2);
    $curl_info = curl_getinfo($ch2);
    curl_close($ch2);
    }
    
    // Clean up cookie file
    if (file_exists($cookieFile)) {
        @unlink($cookieFile);
    }
} else {
    // Login form failed, try Application Password as fallback
    error_log('[login] Login form failed, trying Application Password method...');
    $authString = $actualUsername . ':' . $password;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $meUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_USERPWD, $authString);
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $curl_info = curl_getinfo($ch);
    curl_close($ch);
}

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
    error_log('[login] Both login form and REST API methods failed');
    error_log('[login] Please verify username and password are correct');
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
