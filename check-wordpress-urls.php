<?php
/**
 * Check WordPress URLs from Database
 * This script helps debug WordPress URL configuration
 */

// Load WordPress
require_once __DIR__ . '/wordpress/wp-load.php';

echo "=== WordPress URL Configuration Check ===\n\n";

// Check database values
$home_db = get_option('home');
$siteurl_db = get_option('siteurl');

echo "Database Values:\n";
echo "  home: " . ($home_db ?: 'NOT SET') . "\n";
echo "  siteurl: " . ($siteurl_db ?: 'NOT SET') . "\n\n";

// Check environment variables
$wp_home_env = getenv('WP_HOME');
$wp_siteurl_env = getenv('WP_SITEURL');

echo "Environment Variables:\n";
echo "  WP_HOME: " . ($wp_home_env ?: 'NOT SET') . "\n";
echo "  WP_SITEURL: " . ($wp_siteurl_env ?: 'NOT SET') . "\n\n";

// Check constants
echo "Constants:\n";
if (defined('WP_HOME')) {
    echo "  WP_HOME: " . WP_HOME . "\n";
} else {
    echo "  WP_HOME: NOT DEFINED\n";
}

if (defined('WP_SITEURL')) {
    echo "  WP_SITEURL: " . WP_SITEURL . "\n";
} else {
    echo "  WP_SITEURL: NOT DEFINED\n";
}

// Check what WordPress is actually using
echo "\nWordPress Functions:\n";
echo "  home_url(): " . home_url() . "\n";
echo "  site_url(): " . site_url() . "\n";
echo "  admin_url(): " . admin_url() . "\n";
echo "  content_url(): " . content_url() . "\n";
echo "  includes_url(): " . includes_url() . "\n";
echo "  plugins_url(): " . plugins_url() . "\n";

// Check if mu-plugin is loaded
echo "\n=== MU-Plugin Check ===\n";
$mu_plugins = get_mu_plugins();
if (isset($mu_plugins['fix-image-urls.php'])) {
    echo "fix-image-urls.php: LOADED\n";
    echo "  Version: " . ($mu_plugins['fix-image-urls.php']['Version'] ?: 'N/A') . "\n";
} else {
    echo "fix-image-urls.php: NOT LOADED\n";
}

echo "\n=== Done ===\n";
