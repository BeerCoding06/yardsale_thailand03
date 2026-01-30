<?php
/**
 * User Login - Direct Database Authentication
 * 
 * Endpoint: POST /server/api/php/login.php
 * Body: { username: string, password: string }
 * 
 * Supports both username and email login
 * Authenticates directly against WordPress database using MySQL connection
 */

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors, but log them
ini_set('log_errors', 1);

// Wrap everything in try-catch to catch any fatal errors
try {
    require_once __DIR__ . '/config.php';
    
    // Set CORS headers
    setCorsHeaders();
} catch (Exception $e) {
    error_log('[login] Fatal error loading config: ' . $e->getMessage());
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to load configuration: ' . $e->getMessage()
    ]);
    exit;
}

/**
 * Simple PHPass implementation for WordPress password verification
 * Based on WordPress PasswordHash class
 */
class SimplePasswordHash {
    private $itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    private $iteration_count_log2 = 8;
    
    public function CheckPassword($password, $stored_hash) {
        // WordPress Portable Hash must be 34 characters
        if (strlen($stored_hash) < 34) {
            return false;
        }
        
        // Check hash format ($P$ or $H$)
        $hashPrefix = substr($stored_hash, 0, 3);
        if ($hashPrefix != '$P$' && $hashPrefix != '$H$') {
            return false;
        }
        
        // Get iteration count from hash
        $count_log2 = strpos($this->itoa64, $stored_hash[3]);
        if ($count_log2 === false || $count_log2 < 7 || $count_log2 > 30) {
            return false;
        }
        
        $count = 1 << $count_log2;
        
        // Extract salt (8 characters after the iteration count)
        $salt = substr($stored_hash, 4, 8);
        if (strlen($salt) != 8) {
            return false;
        }
        
        // Hash password with salt
        $hash = md5($salt . $password);
        for ($i = 0; $i < $count; $i++) {
            $hash = md5($hash . $password);
        }
        
        // Build expected hash
        $output = substr($stored_hash, 0, 12);
        $output .= $this->encode64($hash, 16);
        
        // Compare
        return ($output === $stored_hash);
    }
    
    private function encode64($input, $count) {
        $output = '';
        $i = 0;
        do {
            $value = ord($input[$i++]);
            $output .= $this->itoa64[$value & 0x3f];
            if ($i < $count) {
                $value |= ord($input[$i]) << 8;
            }
            $output .= $this->itoa64[($value >> 6) & 0x3f];
            if ($i++ >= $count) {
                break;
            }
            if ($i < $count) {
                $value |= ord($input[$i]) << 16;
            }
            $output .= $this->itoa64[($value >> 12) & 0x3f];
            if ($i++ >= $count) {
                break;
            }
            $output .= $this->itoa64[($value >> 18) & 0x3f];
        } while ($i < $count);
        
        return $output;
    }
}

/**
 * Helper function to unserialize (WordPress style)
 */
function maybe_unserialize($data) {
    if (is_serialized($data)) {
        return unserialize($data);
    }
    return $data;
}

/**
 * Check if data is serialized (WordPress style)
 */
function is_serialized($data) {
    if (!is_string($data)) {
        return false;
    }
    $data = trim($data);
    if ('N;' == $data) {
        return true;
    }
    if (!preg_match('/^([adObis]):/', $data, $badions)) {
        return false;
    }
    switch ($badions[1]) {
        case 'a':
        case 'O':
        case 's':
            if (preg_match("/^{$badions[1]}:[0-9]+:.*[;}]\$/s", $data)) {
                return true;
            }
            break;
        case 'b':
        case 'i':
        case 'd':
            if (preg_match("/^{$badions[1]}:[0-9.E-]+;\$/", $data)) {
                return true;
            }
            break;
    }
    return false;
}

/**
 * Verify WordPress password hash
 * Supports both modern PHP password hashes and WordPress Portable Hashes
 */
function verify_wordpress_password($password, $hash) {
    // Try PHP's password_verify first (for bcrypt, argon2, modern hashes)
    if (password_verify($password, $hash)) {
        return true;
    }
    
    // Check if it's a WordPress Portable Hash ($P$ or $H$)
    if (substr($hash, 0, 3) === '$P$' || substr($hash, 0, 3) === '$H$') {
        try {
            $hasher = new SimplePasswordHash();
            return $hasher->CheckPassword($password, $hash);
        } catch (Exception $e) {
            error_log('[login] PHPass error: ' . $e->getMessage());
            return false;
        }
    }
    
    return false;
}

// Check if PDO extension is available
if (!extension_loaded('pdo') || !extension_loaded('pdo_mysql')) {
    error_log('[login] PDO or PDO_MySQL extension not loaded');
    sendErrorResponse('PDO MySQL extension not available', 500);
}

// Get database connection info from environment
$dbHost = getenv('DB_HOST') ?: '157.85.98.150:3306';
$dbName = getenv('DB_NAME') ?: 'nuxtcommerce_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPassword = getenv('DB_PASSWORD') ?: '';

// Parse host and port
$hostParts = explode(':', $dbHost);
$dbHostOnly = $hostParts[0];
$dbPort = isset($hostParts[1]) ? $hostParts[1] : '3306';

// WordPress table prefix (usually 'wp_' but can be customized)
$tablePrefix = getenv('WP_TABLE_PREFIX') ?: 'wp_';

error_log('[login] Connecting to database: ' . $dbHostOnly . ':' . $dbPort . '/' . $dbName);
error_log('[login] PHP version: ' . PHP_VERSION);
error_log('[login] PDO available: ' . (extension_loaded('pdo') ? 'yes' : 'no'));
error_log('[login] PDO_MySQL available: ' . (extension_loaded('pdo_mysql') ? 'yes' : 'no'));

// Connect to WordPress database
try {
    $dsn = "mysql:host={$dbHostOnly};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    error_log('[login] DSN: ' . $dsn);
    
    $pdo = new PDO(
        $dsn,
        $dbUser,
        $dbPassword,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5
        ]
    );
    error_log('[login] Database connection successful');
} catch (PDOException $e) {
    error_log('[login] Database connection failed: ' . $e->getMessage());
    error_log('[login] PDO Error Code: ' . $e->getCode());
    error_log('[login] Connection details: host=' . $dbHostOnly . ', port=' . $dbPort . ', db=' . $dbName . ', user=' . $dbUser);
    sendErrorResponse('Database connection failed: ' . $e->getMessage() . ' (Code: ' . $e->getCode() . ')', 500);
}

// Get request body (supports both web server and CLI)
$input = getRequestBody();
error_log('[login] Request body length: ' . strlen($input));

$body = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('[login] JSON decode error: ' . json_last_error_msg());
    error_log('[login] Raw input (first 500 chars): ' . substr($input, 0, 500));
    sendErrorResponse('Invalid JSON in request body: ' . json_last_error_msg(), 400);
}

if (!$body || empty($body['username']) || empty($body['password'])) {
    error_log('[login] Error: Missing credentials');
    sendErrorResponse('Missing credentials', 400);
}

$usernameOrEmail = trim($body['username']);
$password = $body['password'];

error_log('[login] Attempting login for: ' . $usernameOrEmail);

// Determine if input is email or username
$isEmail = filter_var($usernameOrEmail, FILTER_VALIDATE_EMAIL);

// Query user from database
$query = "SELECT ID, user_login, user_email, user_pass, display_name, user_nicename 
          FROM {$tablePrefix}users 
          WHERE " . ($isEmail ? "user_email = :identifier" : "user_login = :identifier") . "
          LIMIT 1";

try {
    $stmt = $pdo->prepare($query);
    $stmt->execute([':identifier' => $usernameOrEmail]);
    $user = $stmt->fetch();
    
    if (!$user) {
        error_log('[login] No user found with ' . ($isEmail ? 'email' : 'username') . ': ' . $usernameOrEmail);
        sendErrorResponse('Invalid username or password', 401);
    }
    
    error_log('[login] User found: ID=' . $user['ID'] . ', login=' . $user['user_login']);
    
    // Verify password
    $hash = $user['user_pass'];
    error_log('[login] Password hash type: ' . substr($hash, 0, 10));
    
    // Verify password using our custom function (supports both modern and WordPress hashes)
    $passwordValid = verify_wordpress_password($password, $hash);
    
    if (!$passwordValid) {
        error_log('[login] Password verification failed for user: ' . $user['user_login']);
        sendErrorResponse('Invalid username or password', 401);
    }
    
    error_log('[login] Password verified successfully');
    
    // Password is valid, get user roles from database
    $rolesQuery = "SELECT meta_value FROM {$tablePrefix}usermeta 
                   WHERE user_id = :user_id AND meta_key = '{$tablePrefix}capabilities' 
                   LIMIT 1";
    $rolesStmt = $pdo->prepare($rolesQuery);
    $rolesStmt->execute([':user_id' => $user['ID']]);
    $rolesRow = $rolesStmt->fetch();
    
    $roles = ['subscriber']; // Default role
    if ($rolesRow && $rolesRow['meta_value']) {
        try {
            $capabilities = maybe_unserialize($rolesRow['meta_value']);
            if (is_array($capabilities)) {
                $roles = array_keys($capabilities);
            }
        } catch (Exception $e) {
            error_log('[login] Error unserializing roles: ' . $e->getMessage());
            // Keep default role
        }
    }
    
    error_log('[login] Login successful for user ID: ' . $user['ID'] . ', username: ' . $user['user_login']);
    
    sendJsonResponse([
        'success' => true,
        'user' => [
            'id' => (int)$user['ID'],
            'username' => $user['user_login'],
            'email' => $user['user_email'],
            'name' => $user['display_name'] ?: $user['user_nicename'] ?: $user['user_login'],
            'roles' => $roles
        ]
    ]);
    
} catch (PDOException $e) {
    error_log('[login] Database query failed: ' . $e->getMessage());
    error_log('[login] Query: ' . $query);
    error_log('[login] PDO Error Code: ' . $e->getCode());
    error_log('[login] Stack trace: ' . $e->getTraceAsString());
    
    // Try to send error response, but if that fails, output directly
    try {
        sendErrorResponse('Database query failed: ' . $e->getMessage(), 500);
    } catch (Exception $sendError) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Database query failed: ' . $e->getMessage(),
            'details' => $e->getTraceAsString()
        ]);
        exit;
    }
} catch (Exception $e) {
    error_log('[login] Unexpected error: ' . $e->getMessage());
    error_log('[login] Error type: ' . get_class($e));
    error_log('[login] Stack trace: ' . $e->getTraceAsString());
    
    // Try to send error response, but if that fails, output directly
    try {
        sendErrorResponse('Unexpected error: ' . $e->getMessage(), 500);
    } catch (Exception $sendError) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Unexpected error: ' . $e->getMessage(),
            'details' => $e->getTraceAsString()
        ]);
        exit;
    }
} catch (Error $e) {
    // Catch PHP 7+ fatal errors
    error_log('[login] Fatal error: ' . $e->getMessage());
    error_log('[login] Error type: ' . get_class($e));
    error_log('[login] Stack trace: ' . $e->getTraceAsString());
    
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Fatal error: ' . $e->getMessage(),
        'details' => $e->getTraceAsString()
    ]);
    exit;
}

exit;

?>
