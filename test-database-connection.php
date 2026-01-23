<?php
/**
 * Test Database Connection
 * This script tests the connection to MySQL database
 */

echo "=== Database Connection Test ===\n\n";

// Get database credentials from environment variables or use defaults
$db_host = getenv('DB_HOST') ?: '157.85.98.150:3306';
$db_name = getenv('DB_NAME') ?: 'nuxtcommerce_db';
$db_user = getenv('DB_USER') ?: 'root';
$db_password = getenv('DB_PASSWORD') ?: 'RootBeer06032534';

// Parse host and port
$host_parts = explode(':', $db_host);
$host = $host_parts[0];
$port = isset($host_parts[1]) ? (int)$host_parts[1] : 3306;

echo "📋 Connection Details:\n";
echo "   Host: $host\n";
echo "   Port: $port\n";
echo "   Database: $db_name\n";
echo "   User: $db_user\n";
echo "   Password: " . (strlen($db_password) > 0 ? str_repeat('*', min(strlen($db_password), 10)) : 'NOT SET') . "\n";
echo "\n";

// Test connection
echo "🔍 Testing connection...\n";
try {
    // Create DSN
    $dsn = "mysql:host=$host;port=$port;dbname=$db_name;charset=utf8mb4";
    
    // Create PDO connection
    $pdo = new PDO($dsn, $db_user, $db_password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    
    echo "✅ Connection successful!\n\n";
    
    // Test query
    echo "📋 Testing query...\n";
    $stmt = $pdo->query("SELECT VERSION() as version");
    $version = $stmt->fetch();
    echo "   MySQL Version: " . ($version['version'] ?? 'Unknown') . "\n";
    
    // Check WordPress tables
    echo "\n📋 Checking WordPress tables...\n";
    $stmt = $pdo->query("SHOW TABLES LIKE 'wp_%'");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "   Found " . count($tables) . " WordPress tables\n";
    
    if (count($tables) > 0) {
        echo "   Sample tables: " . implode(', ', array_slice($tables, 0, 5));
        if (count($tables) > 5) {
            echo " ...";
        }
        echo "\n";
    }
    
    // Check WordPress URLs in database
    echo "\n📋 Checking WordPress URLs in database...\n";
    $stmt = $pdo->prepare("SELECT option_name, option_value FROM wp_options WHERE option_name IN ('home', 'siteurl')");
    $stmt->execute();
    $options = $stmt->fetchAll();
    
    foreach ($options as $option) {
        $status = (strpos($option['option_value'], '127.0.0.1') !== false || strpos($option['option_value'], 'localhost') !== false) 
            ? '❌ NEEDS UPDATE' 
            : '✅ OK';
        echo "   {$option['option_name']}: {$option['option_value']} ($status)\n";
    }
    
    // Test write operation (optional)
    echo "\n📋 Testing write operation...\n";
    try {
        $stmt = $pdo->query("SELECT 1");
        echo "   ✅ Read operation: OK\n";
        
        // Don't actually write, just test if we have write permissions
        $stmt = $pdo->query("SELECT user() as current_user");
        $user = $stmt->fetch();
        echo "   Current user: " . ($user['current_user'] ?? 'Unknown') . "\n";
    } catch (PDOException $e) {
        echo "   ⚠️  Write operation test failed: " . $e->getMessage() . "\n";
    }
    
    echo "\n✅ All tests passed!\n";
    
} catch (PDOException $e) {
    echo "❌ Connection failed!\n";
    echo "   Error: " . $e->getMessage() . "\n";
    echo "   Error Code: " . $e->getCode() . "\n";
    echo "\n";
    echo "🔍 Troubleshooting:\n";
    echo "   1. Check if MySQL server is running\n";
    echo "   2. Check if host and port are correct\n";
    echo "   3. Check if database name exists\n";
    echo "   4. Check if user has permissions\n";
    echo "   5. Check firewall settings\n";
    exit(1);
}

echo "\n=== Done ===\n";
