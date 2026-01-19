<?php
/**
 * Debug WordPress URLs
 * This script helps identify where 127.0.0.1 URLs are coming from
 */

// Load WordPress
require_once __DIR__ . '/wordpress/wp-load.php';

echo "=== WordPress URL Debug ===\n\n";

// 1. Check database values
echo "1. Database Values:\n";
$home_db = get_option('home');
$siteurl_db = get_option('siteurl');
echo "   home: " . ($home_db ?: 'NOT SET') . "\n";
echo "   siteurl: " . ($siteurl_db ?: 'NOT SET') . "\n";
if (strpos($home_db, '127.0.0.1') !== false || strpos($siteurl_db, '127.0.0.1') !== false) {
    echo "   ⚠️  Database contains 127.0.0.1 - NEEDS UPDATE!\n";
}
echo "\n";

// 2. Check environment variables
echo "2. Environment Variables:\n";
$wp_home_env = getenv('WP_HOME');
$wp_siteurl_env = getenv('WP_SITEURL');
echo "   WP_HOME: " . ($wp_home_env ?: 'NOT SET') . "\n";
echo "   WP_SITEURL: " . ($wp_siteurl_env ?: 'NOT SET') . "\n";
echo "\n";

// 3. Check constants
echo "3. Constants:\n";
if (defined('WP_HOME')) {
    echo "   WP_HOME: " . WP_HOME . "\n";
} else {
    echo "   WP_HOME: NOT DEFINED\n";
}
if (defined('WP_SITEURL')) {
    echo "   WP_SITEURL: " . WP_SITEURL . "\n";
} else {
    echo "   WP_SITEURL: NOT DEFINED\n";
}
echo "\n";

// 4. Check what WordPress is actually using
echo "4. WordPress Functions (what's actually used):\n";
echo "   home_url(): " . home_url() . "\n";
echo "   site_url(): " . site_url() . "\n";
echo "   includes_url(): " . includes_url() . "\n";
echo "   content_url(): " . content_url() . "\n";
echo "   plugins_url(): " . plugins_url() . "\n";
echo "\n";

// 5. Check if URLs contain 127.0.0.1
$test_urls = [
    'home_url()' => home_url(),
    'site_url()' => site_url(),
    'includes_url()' => includes_url(),
    'content_url()' => content_url(),
    'plugins_url()' => plugins_url(),
];

echo "5. URL Check (127.0.0.1 detection):\n";
foreach ($test_urls as $name => $url) {
    if (strpos($url, '127.0.0.1') !== false) {
        echo "   ❌ $name: Contains 127.0.0.1\n";
    } else {
        echo "   ✅ $name: OK\n";
    }
}
echo "\n";

// 6. Check mu-plugin
echo "6. MU-Plugin Status:\n";
$mu_plugins = get_mu_plugins();
if (isset($mu_plugins['fix-image-urls.php'])) {
    echo "   ✅ fix-image-urls.php: LOADED\n";
    echo "      Version: " . ($mu_plugins['fix-image-urls.php']['Version'] ?: 'N/A') . "\n";
} else {
    echo "   ❌ fix-image-urls.php: NOT LOADED\n";
}
echo "\n";

// 7. Check output buffering
echo "7. Output Buffering Status:\n";
$ob_level = ob_get_level();
echo "   Level: $ob_level\n";
if ($ob_level > 0) {
    echo "   ✅ Output buffering is active\n";
} else {
    echo "   ❌ Output buffering is NOT active\n";
}
echo "\n";

// 8. Recommendations
echo "=== Recommendations ===\n";
if (strpos($home_db, '127.0.0.1') !== false || strpos($siteurl_db, '127.0.0.1') !== false) {
    echo "❌ Database contains 127.0.0.1 URLs\n";
    echo "   → Run: mysql -h 157.85.98.150 -u root -p nuxtcommerce_db < update-wordpress-urls.sql\n";
}
if (!$wp_home_env || !$wp_siteurl_env) {
    echo "❌ Environment variables not set\n";
    echo "   → Check docker-compose.yml\n";
}
if (!isset($mu_plugins['fix-image-urls.php'])) {
    echo "❌ MU-plugin not loaded\n";
    echo "   → Check wordpress/wp-content/mu-plugins/fix-image-urls.php\n";
}
if ($ob_level === 0) {
    echo "❌ Output buffering not active\n";
    echo "   → MU-plugin may not be working correctly\n";
}

echo "\n=== Done ===\n";
