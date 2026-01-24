<?php
/**
 * Fix Image URLs in Database
 * This script updates all image URLs in the database to use the correct domain
 * and removes duplicate /wordpress/wordpress/ paths
 */

// Load WordPress
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

echo "=== Fix Image URLs in Database ===\n\n";

// Get correct domain from environment variables
$wp_home = getenv('WP_HOME') ?: 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me';
$wp_home_trimmed = rtrim($wp_home, '/');

echo "📋 Target Domain: $wp_home_trimmed\n\n";

global $wpdb;

// Patterns to search for (WordPress is at root, NO /wordpress path)
$patterns = [
    'http://localhost/wordpress/wordpress/',
    'https://localhost/wordpress/wordpress/',
    'http://127.0.0.1/wordpress/wordpress/',
    'https://127.0.0.1/wordpress/wordpress/',
    'http://localhost/wordpress/',
    'https://localhost/wordpress/',
    'http://127.0.0.1/wordpress/',
    'https://127.0.0.1/wordpress/',
    'http://localhost/',
    'https://localhost/',
    'http://127.0.0.1/',
    'https://127.0.0.1/',
];

$replacements = [
    $wp_home_trimmed . '/',  // Remove /wordpress/wordpress/
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',  // Remove /wordpress/
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',  // Root level
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',
    $wp_home_trimmed . '/',
];

// Tables to update
$tables = [
    $wpdb->posts => ['post_content', 'post_excerpt', 'post_title'],
    $wpdb->postmeta => ['meta_value'],
    $wpdb->options => ['option_value'],
    $wpdb->comments => ['comment_content'],
    $wpdb->commentmeta => ['meta_value'],
];

$total_updated = 0;

foreach ($tables as $table => $columns) {
    echo "📝 Processing table: $table\n";
    
    foreach ($columns as $column) {
        // Check if column exists
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM `$table` LIKE '$column'");
        if (empty($column_exists)) {
            echo "   ⚠️  Column $column does not exist, skipping...\n";
            continue;
        }
        
        // Count rows that need updating
        $count_query = "SELECT COUNT(*) as count FROM `$table` WHERE `$column` LIKE '%localhost%' OR `$column` LIKE '%127.0.0.1%' OR `$column` LIKE '%/wordpress/%'";
        $count = $wpdb->get_var($count_query);
        
        if ($count > 0) {
            echo "   📊 Found $count rows in $column that need updating\n";
            
            // Update each pattern
            foreach ($patterns as $index => $pattern) {
                $replacement = $replacements[$index];
                
                // Use REPLACE function for exact matches
                $sql = $wpdb->prepare(
                    "UPDATE `$table` SET `$column` = REPLACE(`$column`, %s, %s) WHERE `$column` LIKE %s",
                    $pattern,
                    $replacement,
                    '%' . $wpdb->esc_like($pattern) . '%'
                );
                
                $result = $wpdb->query($sql);
                if ($result !== false) {
                    echo "      ✅ Updated " . $result . " rows (pattern: $pattern)\n";
                    $total_updated += $result;
                }
            }
            
            // Remove /wordpress/ paths (WordPress is at root)
            $sql = $wpdb->prepare(
                "UPDATE `$table` SET `$column` = REPLACE(`$column`, %s, %s) WHERE `$column` LIKE %s",
                '/wordpress/',
                '/',
                '%/wordpress/%'
            );
            
            $result = $wpdb->query($sql);
            if ($result !== false && $result > 0) {
                echo "      ✅ Removed " . $result . " /wordpress/ paths\n";
                $total_updated += $result;
            }
        } else {
            echo "   ✅ No rows need updating in $column\n";
        }
    }
    echo "\n";
}

echo "=== Summary ===\n";
echo "✅ Total rows updated: $total_updated\n\n";

// Verify some sample URLs
echo "📋 Verifying sample URLs...\n";
$sample_posts = $wpdb->get_results("SELECT ID, post_title FROM {$wpdb->posts} WHERE post_content LIKE '%wp-content/uploads%' LIMIT 5");
foreach ($sample_posts as $post) {
    $content = get_post_field('post_content', $post->ID);
    if (preg_match('#(http://localhost|http://127\.0\.0\.1|/wordpress/wordpress/)#', $content)) {
        echo "   ⚠️  Post #{$post->ID} ({$post->post_title}) still contains localhost or duplicate paths\n";
    } else {
        echo "   ✅ Post #{$post->ID} ({$post->post_title}) URLs are correct\n";
    }
}

echo "\n=== Done ===\n";
echo "\n📋 Next steps:\n";
echo "   1. Clear WordPress cache\n";
echo "   2. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)\n";
echo "   3. Check product pages to verify image URLs\n";
