<?php
/**
 * Fix WordPress Settings (Home URL and Site URL)
 * This script updates WordPress settings directly in the database
 */

// Load WordPress
// Try multiple paths to find wp-load.php
$wp_load_paths = [
    __DIR__ . '/wordpress/wp-load.php',  // From project root
    __DIR__ . '/wp-load.php',            // From wordpress directory
    '/app/wordpress/wp-load.php',        // From Docker container
];

$wp_loaded = false;
foreach ($wp_load_paths as $path) {
    if (file_exists($path)) {
        require_once $path;
        $wp_loaded = true;
        break;
    }
}

if (!$wp_loaded) {
    die("❌ Error: Could not find wp-load.php. Please run this script from the project root or Docker container.\n");
}

echo "=== Fix WordPress Settings ===\n\n";

// Get correct URLs from environment variables
$wp_home = getenv('WP_HOME') ?: 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me';
$wp_siteurl = getenv('WP_SITEURL') ?: 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress';

// Remove trailing slashes
$wp_home = rtrim($wp_home, '/');
$wp_siteurl = rtrim($wp_siteurl, '/');

echo "📋 Target URLs:\n";
echo "   Home URL: $wp_home\n";
echo "   Site URL: $wp_siteurl\n\n";

// Get current values from database
$current_home = get_option('home');
$current_siteurl = get_option('siteurl');

echo "📋 Current URLs in database:\n";
echo "   Home URL: $current_home\n";
echo "   Site URL: $current_siteurl\n\n";

// Check if update is needed
$needs_update = false;
if ($current_home !== $wp_home) {
    echo "⚠️  Home URL needs update\n";
    $needs_update = true;
}
if ($current_siteurl !== $wp_siteurl) {
    echo "⚠️  Site URL needs update\n";
    $needs_update = true;
}

if (!$needs_update) {
    echo "✅ URLs are already correct!\n";
    exit(0);
}

echo "\n📝 Updating WordPress settings...\n";

// Update Home URL
if ($current_home !== $wp_home) {
    $result = update_option('home', $wp_home);
    if ($result) {
        echo "✅ Home URL updated successfully\n";
    } else {
        echo "❌ Failed to update Home URL\n";
    }
}

// Update Site URL
if ($current_siteurl !== $wp_siteurl) {
    $result = update_option('siteurl', $wp_siteurl);
    if ($result) {
        echo "✅ Site URL updated successfully\n";
    } else {
        echo "❌ Failed to update Site URL\n";
    }
}

// Verify the changes
echo "\n📋 Verifying changes...\n";
$new_home = get_option('home');
$new_siteurl = get_option('siteurl');

echo "   Home URL: $new_home " . ($new_home === $wp_home ? '✅' : '❌') . "\n";
echo "   Site URL: $new_siteurl " . ($new_siteurl === $wp_siteurl ? '✅' : '❌') . "\n";

// Test WordPress functions
echo "\n📋 Testing WordPress URL functions:\n";
echo "   home_url(): " . home_url() . "\n";
echo "   site_url(): " . site_url() . "\n";
echo "   includes_url(): " . includes_url() . "\n";
echo "   content_url(): " . content_url() . "\n";

// Check if URLs contain 127.0.0.1
echo "\n📋 Checking for 127.0.0.1 URLs:\n";
$test_urls = [
    'home_url()' => home_url(),
    'site_url()' => site_url(),
    'includes_url()' => includes_url(),
    'content_url()' => content_url(),
];

$has_127 = false;
foreach ($test_urls as $name => $url) {
    if (strpos($url, '127.0.0.1') !== false) {
        echo "   ❌ $name: Contains 127.0.0.1\n";
        $has_127 = true;
    } else {
        echo "   ✅ $name: OK\n";
    }
}

if ($has_127) {
    echo "\n⚠️  Some URLs still contain 127.0.0.1\n";
    echo "   This may be due to:\n";
    echo "   1. Cache - try clearing WordPress cache\n";
    echo "   2. mu-plugin not working - check fix-image-urls.php\n";
    echo "   3. Output buffering not active\n";
} else {
    echo "\n✅ All URLs are correct!\n";
}

echo "\n=== Done ===\n";
echo "\n📋 Next steps:\n";
echo "   1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)\n";
echo "   2. Check WordPress login page\n";
echo "   3. Verify that CSS/JS files load correctly\n";
