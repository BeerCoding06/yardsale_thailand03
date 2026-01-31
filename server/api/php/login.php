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
// In Docker, connect to database container by name, not IP
// WordPress database container: wp_db
// Database: wordpress
// User: wpuser (NOT root - root is blocked from external network)
// Password: wppass
$dbHost = getenv('DB_HOST') ?: 'wp_db'; // Use container name, not IP
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('WP_DB_NAME') ?: getenv('DB_DATABASE') ?: 'wordpress';
$tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';

// Use wpuser (NOT root - root is blocked from external network)
$dbUser = getenv('WP_DB_USER') ?: getenv('DB_USER') ?: 'wpuser';
$dbPassword = getenv('WP_DB_PASSWORD') ?: getenv('DB_PASSWORD') ?: 'wppass';

error_log('[login] Database config: host=' . $dbHost . ', port=' . $dbPort . ', db=' . $dbName . ', user=' . $dbUser);

// If DB_HOST contains port (e.g., "wp_db:3306"), extract it
$hostParts = explode(':', $dbHost);
$dbHostOnly = $hostParts[0];
if (count($hostParts) > 1) {
    $dbPort = $hostParts[1];
}

// Connect to database
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
        'error' => 'Database connection failed',
        'debug' => [
            'error' => $e->getMessage(),
            'host' => $dbHostOnly,
            'port' => $dbPort,
            'database' => $dbName,
            'user' => $dbUser
        ]
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
    
    // Normalize WordPress bcrypt hash ($wp$2y$10$ -> $2y$10$)
    // Example: $wp$2y$10$E1x/FVwd/z8QjTy/1URAquU/T3tzxuH8cyu6mfYklHKoaiys3q9j6
    // Should become: $2y$10$E1x/FVwd/z8QjTy/1URAquU/T3tzxuH8cyu6mfYklHKoaiys3q9j6
    $normalizedHash = $hash;
    if (substr($hash, 0, 4) === '$wp$') {
        $parts = explode('$', $hash);
        error_log('[login] Hash parts: ' . json_encode($parts));
        error_log('[login] Hash parts count: ' . count($parts));
        
        // Check if it's WordPress bcrypt format: $wp$2y$10$...
        if (count($parts) >= 5 && $parts[1] === 'wp' && $parts[2] === '2y') {
            // Reconstruct as standard bcrypt: $2y$10$salt+hash
            $normalizedHash = '$' . $parts[2] . '$' . $parts[3] . '$' . $parts[4];
            error_log('[login] Normalized WordPress hash');
            error_log('[login] Original hash: ' . $hash);
            error_log('[login] Normalized hash: ' . $normalizedHash);
            error_log('[login] Original hash length: ' . strlen($hash));
            error_log('[login] Normalized hash length: ' . strlen($normalizedHash));
        } else {
            error_log('[login] Hash parts do not match expected format');
            error_log('[login] parts[1]=' . ($parts[1] ?? 'N/A') . ', parts[2]=' . ($parts[2] ?? 'N/A'));
        }
    } else {
        error_log('[login] Hash does not have $wp$ prefix, using as-is');
    }
    
    // Verify password
    error_log('[login] Attempting password_verify with normalized hash...');
    error_log('[login] Normalized hash for verification: ' . $normalizedHash);
    $passwordValid = password_verify($password, $normalizedHash);
    error_log('[login] password_verify result: ' . ($passwordValid ? 'TRUE' : 'FALSE'));
    
    // If normalized hash failed, try original hash
    if (!$passwordValid && $normalizedHash !== $hash) {
        error_log('[login] Trying password_verify with original hash...');
        $passwordValid = password_verify($password, $hash);
        error_log('[login] password_verify with original hash result: ' . ($passwordValid ? 'TRUE' : 'FALSE'));
    }
    
    // Additional check: verify the hash format is correct
    if (!$passwordValid) {
        // Check if normalized hash is valid bcrypt format
        $isValidBcrypt = preg_match('/^\$2[ayb]\$\d{2}\$[./0-9A-Za-z]{53}$/', $normalizedHash);
        error_log('[login] Normalized hash is valid bcrypt format: ' . ($isValidBcrypt ? 'TRUE' : 'FALSE'));
        
        // Try to create a test hash with the same password to verify password_verify works
        $testHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $testVerify = password_verify($password, $testHash);
        error_log('[login] Test password_verify with new hash: ' . ($testVerify ? 'TRUE' : 'FALSE'));
        
        if (!$testVerify) {
            error_log('[login] WARNING: password_verify() may not be working correctly!');
        }
    }
    
    if (!$passwordValid) {
        error_log('[login] Password verification failed');
        error_log('[login] Password provided: ' . substr($password, 0, 3) . '*** (length: ' . strlen($password) . ')');
        error_log('[login] Original hash: ' . $hash);
        error_log('[login] Normalized hash: ' . $normalizedHash);
        
        // Include debug info in response for troubleshooting
        $hashParts = explode('$', $hash);
        $isValidBcrypt = preg_match('/^\$2[ayb]\$\d{2}\$[./0-9A-Za-z]{53}$/', $normalizedHash);
        
        // Test if password_verify works at all
        $testHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $testVerify = password_verify($password, $testHash);
        
        $debugInfo = [
            'hash_length' => $hashLength,
            'hash_prefix' => $hashPrefix,
            'hash_full' => $hash, // Include full hash for debugging
            'normalized_hash_length' => strlen($normalizedHash),
            'normalized_hash_prefix' => substr($normalizedHash, 0, 10),
            'normalized_hash_full' => $normalizedHash, // Include full normalized hash
            'password_length' => strlen($password),
            'hash_parts' => $hashParts,
            'hash_parts_count' => count($hashParts),
            'is_valid_bcrypt_format' => $isValidBcrypt,
            'password_verify_test' => $testVerify, // Test if password_verify works
            'test_hash_prefix' => substr($testHash, 0, 10),
        ];
        
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid username or password',
            'debug' => $debugInfo
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
