<?php
/**
 * Check Environment Variables in PHP Runtime
 * This script helps debug if environment variables are properly set
 */

echo "=== WordPress Environment Variables Check ===\n\n";

// Check WP_HOME
$wp_home_env = getenv('WP_HOME');
echo "WP_HOME (getenv): " . ($wp_home_env ?: 'NOT SET') . "\n";

// Check WP_SITEURL
$wp_siteurl_env = getenv('WP_SITEURL');
echo "WP_SITEURL (getenv): " . ($wp_siteurl_env ?: 'NOT SET') . "\n";

// Check BASE_URL
$base_url_env = getenv('BASE_URL');
echo "BASE_URL (getenv): " . ($base_url_env ?: 'NOT SET') . "\n";

// Check if constants are defined
if (defined('WP_HOME')) {
    echo "WP_HOME (constant): " . WP_HOME . "\n";
} else {
    echo "WP_HOME (constant): NOT DEFINED\n";
}

if (defined('WP_SITEURL')) {
    echo "WP_SITEURL (constant): " . WP_SITEURL . "\n";
} else {
    echo "WP_SITEURL (constant): NOT DEFINED\n";
}

// Check all environment variables
echo "\n=== All Environment Variables ===\n";
$env_vars = [
    'WP_HOME',
    'WP_SITEURL',
    'BASE_URL',
    'WP_MEDIA_HOST',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'INTERNAL_BASE_URL',
];

foreach ($env_vars as $var) {
    $value = getenv($var);
    echo "$var: " . ($value ?: 'NOT SET') . "\n";
}

// Check $_SERVER variables
echo "\n=== Server Variables ===\n";
echo "HTTP_HOST: " . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'NOT SET') . "\n";
echo "HTTP_X_FORWARDED_HOST: " . (isset($_SERVER['HTTP_X_FORWARDED_HOST']) ? $_SERVER['HTTP_X_FORWARDED_HOST'] : 'NOT SET') . "\n";
echo "HTTP_X_FORWARDED_PROTO: " . (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) ? $_SERVER['HTTP_X_FORWARDED_PROTO'] : 'NOT SET') . "\n";
echo "HTTPS: " . (isset($_SERVER['HTTPS']) ? $_SERVER['HTTPS'] : 'NOT SET') . "\n";
echo "REQUEST_URI: " . (isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : 'NOT SET') . "\n";

echo "\n=== Done ===\n";
