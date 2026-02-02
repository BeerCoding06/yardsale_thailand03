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
    error_log('[login] Raw input: ' . substr($input, 0, 500));
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid JSON: ' . json_last_error_msg()
    ]);
    exit();
}

// Log parsed body (hide password for security)
$logBody = $body;
if (isset($logBody['password'])) {
    $logBody['password'] = '***hidden***';
}
error_log('[login] Parsed request body: ' . json_encode($logBody));

if (!isset($body['username']) || !isset($body['password'])) {
    error_log('[login] Missing required fields. Body keys: ' . implode(', ', array_keys($body)));
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Username and password are required'
    ]);
    exit();
}

$username = trim($body['username']);
$password = $body['password'];

error_log('[login] Attempting login for username: ' . $username);

// WordPress REST API endpoint
// Try JWT Authentication first, then fallback to other methods
$wpBaseUrl = getenv('WP_BASE_URL') ?: 'http://157.85.98.150:8080';

// Method 1: Try JWT Authentication plugin
// JWT endpoint is at /wp-json/jwt-auth/v1/token (not /wordpress/wp-json/...)
$jwtUrl = rtrim($wpBaseUrl, '/') . '/wp-json/jwt-auth/v1/token';
error_log('[login] Trying JWT Authentication: ' . $jwtUrl);

$ch = curl_init($jwtUrl);
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

$wpUser = null;
$jwtToken = null;

// If JWT endpoint works (200), use it
if ($httpCode === 200 && !$curlError) {
    $responseData = json_decode($response, true);
    error_log('[login] JWT response data: ' . json_encode($responseData));
    
    if (isset($responseData['token'])) {
        $jwtToken = $responseData['token'];
        
        // JWT response format:
        // {
        //   "token": "...",
        //   "user_email": "...",
        //   "user_nicename": "...",
        //   "user_display_name": "..."
        // }
        // We need to decode JWT token to get user ID from payload
        // JWT format: header.payload.signature
        $tokenParts = explode('.', $jwtToken);
        $userId = null;
        
        if (count($tokenParts) >= 2) {
            // Decode payload (base64url)
            $payload = json_decode(base64_decode(strtr($tokenParts[1], '-_', '+/')), true);
            if (isset($payload['data']['user']['id'])) {
                $userId = $payload['data']['user']['id'];
            }
        }
        
        // Build user data from JWT response
        $wpUser = [
            'id' => $userId ?: null,
            'username' => $responseData['user_nicename'] ?? $username,
            'email' => $responseData['user_email'] ?? $username,
            'name' => $responseData['user_display_name'] ?? $responseData['user_nicename'] ?? $username,
            'slug' => $responseData['user_nicename'] ?? '',
            'roles' => ['subscriber'], // Default role, JWT doesn't return roles
        ];
        
        error_log('[login] JWT Authentication successful. User ID: ' . ($userId ?: 'N/A'));
    } else {
        error_log('[login] JWT response missing token field');
    }
}

// Method 2: If JWT failed, use database authentication with wp_check_password
// This requires loading WordPress core, but it's the most reliable method
if (!$wpUser) {
    error_log('[login] JWT Authentication not available, using database authentication...');
    
    // Database connection
    // IMPORTANT: Use container name wp_db, NOT IP address
    // IMPORTANT: Use wpuser/wppass, NOT root (root is blocked from external network)
    
    // Force container name, ignore DB_HOST if it's an IP address
    $dbHostEnv = getenv('DB_HOST');
    if (empty($dbHostEnv) || filter_var($dbHostEnv, FILTER_VALIDATE_IP)) {
        // If DB_HOST is empty or is an IP address, use container name
        $dbHost = 'wp_db'; // Container name for Docker network
    } else {
        $dbHost = $dbHostEnv;
    }
    
    $dbPort = getenv('DB_PORT') ?: '3306';
    $dbName = getenv('WP_DB_NAME') ?: 'wordpress';
    
    // Force wpuser, ignore DB_USER if it's root
    $dbUserEnv = getenv('WP_DB_USER');
    if (empty($dbUserEnv) || $dbUserEnv === 'root') {
        $dbUser = 'wpuser'; // Use wpuser, NOT root
    } else {
        $dbUser = $dbUserEnv;
    }
    
    // Force wppass, ignore DB_PASSWORD
    $dbPasswordEnv = getenv('WP_DB_PASSWORD');
    if (empty($dbPasswordEnv)) {
        $dbPassword = 'wppass'; // Use wppass
    } else {
        $dbPassword = $dbPasswordEnv;
    }
    
    $tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';
    
    $hostParts = explode(':', $dbHost);
    $dbHostOnly = $hostParts[0];
    if (count($hostParts) > 1) {
        $dbPort = $hostParts[1];
    }
    
    error_log('[login] Database config:');
    error_log('[login]   - DB_HOST env: ' . ($dbHostEnv ?? 'not set'));
    error_log('[login]   - Final host: ' . $dbHostOnly);
    error_log('[login]   - Port: ' . $dbPort);
    error_log('[login]   - Database: ' . $dbName);
    error_log('[login]   - WP_DB_USER env: ' . ($dbUserEnv ?? 'not set'));
    error_log('[login]   - Final user: ' . $dbUser);
    error_log('[login]   - WP_DB_PASSWORD env: ' . ($dbPasswordEnv ? '***set***' : 'not set'));
    error_log('[login]   - Table prefix: ' . $tablePrefix);
    
    try {
        $pdo = new PDO(
            "mysql:host={$dbHostOnly};port={$dbPort};dbname={$dbName};charset=utf8mb4",
            $dbUser,
            $dbPassword,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 10
            ]
        );
        error_log('[login] Database connection successful');
        
        // Query user
        $isEmail = filter_var($username, FILTER_VALIDATE_EMAIL);
        $query = "SELECT ID, user_login, user_email, user_pass, display_name, user_nicename 
                  FROM {$tablePrefix}users 
                  WHERE " . ($isEmail ? "user_email = :identifier" : "user_login = :identifier") . "
                  LIMIT 1";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([':identifier' => $username]);
        $user = $stmt->fetch();
        
        if (!$user) {
            error_log('[login] User not found: ' . $username);
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid username or password'
            ]);
            exit();
        }
        
        error_log('[login] User found: ID=' . $user['ID']);
        
        // Use WordPress wp_check_password function
        // We need to load WordPress core to use this function
        $wpLoadPath = '/var/www/html/wp-load.php';
        if (file_exists($wpLoadPath)) {
            require_once $wpLoadPath;
            if (defined('ABSPATH') && defined('WPINC')) {
                require_once ABSPATH . WPINC . '/pluggable.php';
            }
            
            // Use wp_check_password which handles all WordPress hash formats
            if (function_exists('wp_check_password')) {
                $passwordValid = wp_check_password($password, $user['user_pass']);
                error_log('[login] wp_check_password result: ' . ($passwordValid ? 'TRUE' : 'FALSE'));
                
                if (!$passwordValid) {
                    error_log('[login] Password verification failed');
                    http_response_code(401);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Invalid username or password'
                    ]);
                    exit();
                }
                
                // Get user roles
                $rolesQuery = "SELECT meta_value FROM {$tablePrefix}usermeta 
                               WHERE user_id = :user_id AND meta_key = '{$tablePrefix}capabilities' 
                               LIMIT 1";
                $rolesStmt = $pdo->prepare($rolesQuery);
                $rolesStmt->execute([':user_id' => $user['ID']]);
                $rolesRow = $rolesStmt->fetch();
                
                $roles = ['subscriber'];
                if ($rolesRow && $rolesRow['meta_value']) {
                    $capabilities = unserialize($rolesRow['meta_value']);
                    if (is_array($capabilities)) {
                        $roles = array_keys($capabilities);
                    }
                }
                
                // Get user meta
                $first_name = '';
                $last_name = '';
                $profile_picture_id = null;
                
                $metaQuery = "SELECT meta_key, meta_value FROM {$tablePrefix}usermeta 
                              WHERE user_id = :user_id AND meta_key IN ('first_name', 'last_name', 'profile_picture_id')";
                $metaStmt = $pdo->prepare($metaQuery);
                $metaStmt->execute([':user_id' => $user['ID']]);
                $metaRows = $metaStmt->fetchAll();
                
                foreach ($metaRows as $metaRow) {
                    if ($metaRow['meta_key'] === 'first_name') {
                        $first_name = $metaRow['meta_value'];
                    } elseif ($metaRow['meta_key'] === 'last_name') {
                        $last_name = $metaRow['meta_value'];
                    } elseif ($metaRow['meta_key'] === 'profile_picture_id') {
                        $profile_picture_id = intval($metaRow['meta_value']);
                    }
                }
                
                // Build user data
                $wpUser = [
                    'id' => $user['ID'],
                    'username' => $user['user_login'],
                    'email' => $user['user_email'],
                    'name' => $user['display_name'] ?: $user['user_login'],
                    'slug' => $user['user_nicename'],
                    'roles' => $roles,
                    'first_name' => $first_name,
                    'last_name' => $last_name,
                ];
                
                error_log('[login] Database authentication successful');
            } else {
                error_log('[login] wp_check_password function not available');
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'WordPress password verification function not available'
                ]);
                exit();
            }
        } else {
            error_log('[login] WordPress core not found at: ' . $wpLoadPath);
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'WordPress core not found'
            ]);
            exit();
        }
    } catch (PDOException $e) {
        error_log('[login] Database connection failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database connection failed: ' . $e->getMessage()
        ]);
        exit();
    }
}

if (!$wpUser) {
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
    'profile_picture_id' => $wpUser['profile_picture_id'] ?? null,
    'profile_picture_url' => $wpUser['profile_picture_url'] ?? null,
];

// Include JWT token if available
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
