<?php
/**
 * User Login - Direct Database Authentication
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string, remember?: boolean }
 * 
 * Supports both username and email login
 * Authenticates directly against WordPress database
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

// Database connection
$dbHost = getenv('DB_HOST') ?: '157.85.98.150:3306';
$dbName = getenv('DB_NAME') ?: 'nuxtcommerce_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPassword = getenv('DB_PASSWORD') ?: 'RootBeer06032534';
$tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';

$hostParts = explode(':', $dbHost);
$dbHostOnly = $hostParts[0];
$dbPort = isset($hostParts[1]) ? $hostParts[1] : '3306';

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
} catch (PDOException $e) {
    error_log('[login] Database connection failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed'
    ]);
    exit();
}

// Determine if input is email or username
$isEmail = filter_var($username, FILTER_VALIDATE_EMAIL);

// Query user from database
$query = "SELECT ID, user_login, user_email, user_pass, display_name, user_nicename 
          FROM {$tablePrefix}users 
          WHERE " . ($isEmail ? "user_email = :identifier" : "user_login = :identifier") . "
          LIMIT 1";

try {
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
    
    error_log('[login] User found: ID=' . $user['ID'] . ', login=' . $user['user_login']);
    
    // Verify password
    $hash = $user['user_pass'];
    $hashLength = strlen($hash);
    $hashPrefix = substr($hash, 0, 10);
    error_log('[login] Hash length: ' . $hashLength);
    error_log('[login] Hash prefix: ' . $hashPrefix);
    error_log('[login] Hash (first 50 chars): ' . substr($hash, 0, 50));
    
    // Normalize WordPress bcrypt hash ($wp$2y$12$ -> $2y$12$)
    $normalizedHash = $hash;
    if (substr($hash, 0, 4) === '$wp$') {
        $parts = explode('$', $hash);
        error_log('[login] Hash parts count: ' . count($parts));
        if (count($parts) >= 5 && $parts[1] === 'wp' && $parts[2] === '2y') {
            $normalizedHash = '$' . $parts[2] . '$' . $parts[3] . '$' . $parts[4];
            error_log('[login] Normalized WordPress hash');
            error_log('[login] Original hash: ' . substr($hash, 0, 30) . '...');
            error_log('[login] Normalized hash: ' . substr($normalizedHash, 0, 30) . '...');
            error_log('[login] Normalized hash length: ' . strlen($normalizedHash));
        } else {
            error_log('[login] Hash parts do not match expected format');
        }
    } else {
        error_log('[login] Hash does not have $wp$ prefix, using as-is');
    }
    
    // Verify password
    error_log('[login] Attempting password_verify with normalized hash...');
    $passwordValid = password_verify($password, $normalizedHash);
    error_log('[login] password_verify result: ' . ($passwordValid ? 'TRUE' : 'FALSE'));
    
    // If normalized hash failed, try original hash
    if (!$passwordValid && $normalizedHash !== $hash) {
        error_log('[login] Trying password_verify with original hash...');
        $passwordValid = password_verify($password, $hash);
        error_log('[login] password_verify with original hash result: ' . ($passwordValid ? 'TRUE' : 'FALSE'));
    }
    
    if (!$passwordValid) {
        error_log('[login] Password verification failed');
        error_log('[login] Password provided: ' . substr($password, 0, 3) . '*** (length: ' . strlen($password) . ')');
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid username or password'
        ]);
        exit();
    }
    
    error_log('[login] Password verified successfully');
    
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
    
    // Build user data response
    $user_data = [
        'id' => $user['ID'],
        'username' => $user['user_login'],
        'email' => $user['user_email'],
        'name' => $user['display_name'] ?: $user['user_login'],
        'slug' => $user['user_nicename'],
        'roles' => $roles,
        'first_name' => $first_name,
        'last_name' => $last_name,
        'profile_picture_id' => $profile_picture_id,
        'profile_picture_url' => null,
    ];
    
    // Return success response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => $user_data,
        'message' => 'Login successful'
    ]);
    
} catch (PDOException $e) {
    error_log('[login] Database query failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database query failed'
    ]);
    exit();
}
