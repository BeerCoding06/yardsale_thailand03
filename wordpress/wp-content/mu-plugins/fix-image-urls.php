<?php
/**
 * Plugin Name: Fix Image URLs
 * Description: Replace localhost URLs with correct domain for production
 * Version: 1.0
 * Author: Auto-generated
 */

// Helper function to fix URLs
function fix_url($url) {
    if (!$url) return $url;
    
    $wp_home = getenv('WP_HOME') ?: (defined('WP_HOME') ? WP_HOME : '');
    if (!$wp_home) return $url;
    
    $wp_home_trimmed = rtrim($wp_home, '/');
    
    // Check if URL already contains the correct domain - skip if already fixed
    if (strpos($url, $wp_home_trimmed) === 0) {
        // Already has correct domain, but check for duplicate /wordpress/
        $url = preg_replace('#(/wordpress/wordpress/)#', '/wordpress/', $url);
        return $url;
    }
    
    // Only replace if URL contains localhost or 127.0.0.1
    if (strpos($url, '127.0.0.1') === false && strpos($url, 'localhost') === false) {
        return $url;
    }
    
    // Parse the URL to understand its structure
    $parsed = parse_url($url);
    if (!$parsed || !isset($parsed['host'])) {
        return $url;
    }
    
    // Get the path
    $path = isset($parsed['path']) ? $parsed['path'] : '/';
    
    // Check if path already starts with /wordpress
    $has_wordpress_prefix = (strpos($path, '/wordpress/') === 0 || $path === '/wordpress');
    
    // Replace host and scheme
    $new_url = $wp_home_trimmed;
    
    // If the original URL had /wordpress prefix, keep it
    // If not, add /wordpress prefix
    if ($has_wordpress_prefix) {
        // Path already has /wordpress, so just replace the domain
        $new_url .= $path;
    } else {
        // Path doesn't have /wordpress, add it
        $new_url .= '/wordpress' . $path;
    }
    
    // Add query string if exists
    if (isset($parsed['query'])) {
        $new_url .= '?' . $parsed['query'];
    }
    
    // Add fragment if exists
    if (isset($parsed['fragment'])) {
        $new_url .= '#' . $parsed['fragment'];
    }
    
    // Remove any duplicate /wordpress/wordpress/ patterns
    $new_url = preg_replace('#(/wordpress/wordpress/)#', '/wordpress/', $new_url);
    
    return $new_url;
}

// Force WordPress to use correct URLs for media files
// This filter replaces localhost URLs with the correct domain
add_filter('wp_get_attachment_url', function($url) {
    return fix_url($url);
}, 10, 1);

// Also filter image URLs in content and srcset
add_filter('wp_calculate_image_srcset', function($sources) {
    if (!is_array($sources)) return $sources;
    
    foreach ($sources as &$source) {
        if (isset($source['url'])) {
            $source['url'] = fix_url($source['url']);
        }
    }
    return $sources;
}, 10, 1);

// Filter attachment image src attribute
add_filter('wp_get_attachment_image_src', function($image, $attachment_id, $size, $icon) {
    if (!$image || !is_array($image)) return $image;
    
    if (isset($image[0])) {
        $image[0] = fix_url($image[0]);
    }
    return $image;
}, 10, 4);

// Filter script and style URLs (for CSS/JS files)
// Priority 999 = runs after all other filters to ensure we catch all URLs
add_filter('script_loader_src', function($src, $handle) {
    return fix_url($src);
}, 999, 2);

add_filter('style_loader_src', function($src, $handle) {
    return fix_url($src);
}, 999, 2);

// ============================================
// OVERRIDE DATABASE VALUES WITH ENVIRONMENT VARIABLES
// ============================================
// pre_option_* filters run BEFORE WordPress queries the database
// Returning a non-false value will short-circuit the database query
// Priority 1 = highest priority, runs before all other filters
// This ensures WordPress ALWAYS uses environment variables from docker-compose.yml

add_filter('pre_option_home', function($pre, $option, $default_value) {
    // Priority: 1. Environment variable (from docker-compose.yml), 2. Constant, 3. Database
    $wp_home = getenv('WP_HOME');
    if ($wp_home && $wp_home !== '') {
        // Return environment variable - this will short-circuit database query
        return rtrim($wp_home, '/');
    }
    // Fallback to constant (defined in wp-config.php)
    if (defined('WP_HOME') && WP_HOME !== '') {
        return rtrim(WP_HOME, '/');
    }
    // Return false to allow WordPress to query database (fallback)
    return false;
}, 1, 3);

add_filter('pre_option_siteurl', function($pre, $option, $default_value) {
    // Priority: 1. Environment variable (from docker-compose.yml), 2. Constant, 3. Database
    $wp_siteurl = getenv('WP_SITEURL');
    if ($wp_siteurl && $wp_siteurl !== '') {
        // Return environment variable - this will short-circuit database query
        return rtrim($wp_siteurl, '/');
    }
    // Fallback to constant (defined in wp-config.php)
    if (defined('WP_SITEURL') && WP_SITEURL !== '') {
        return rtrim(WP_SITEURL, '/');
    }
    // Return false to allow WordPress to query database (fallback)
    return false;
}, 1, 3);

// Filter WordPress core URLs
// Priority 999 = runs after all other filters to ensure we catch all URLs
add_filter('site_url', function($url, $path, $scheme, $blog_id) {
    return fix_url($url);
}, 999, 4);

add_filter('home_url', function($url, $path, $scheme, $blog_id) {
    return fix_url($url);
}, 999, 4);

add_filter('content_url', function($url, $path) {
    return fix_url($url);
}, 999, 2);

add_filter('plugins_url', function($url, $path, $plugin) {
    return fix_url($url);
}, 999, 3);

add_filter('includes_url', function($url, $path) {
    return fix_url($url);
}, 999, 2);

add_filter('admin_url', function($url, $path, $blog_id) {
    return fix_url($url);
}, 999, 3);

// Filter all URLs in content
add_filter('the_content', function($content) {
    if (!$content) return $content;
    
    // Replace all localhost/127.0.0.1 URLs in HTML content
    $wp_home = getenv('WP_HOME') ?: (defined('WP_HOME') ? WP_HOME : '');
    if ($wp_home) {
        $wp_home_trimmed = rtrim($wp_home, '/');
        
        // Replace in href and src attributes
        $content = preg_replace(
            '/(href|src)=["\']http:\/\/(127\.0\.0\.1|localhost)\/wordpress\//i',
            '$1="' . $wp_home_trimmed . '/wordpress/',
            $content
        );
        $content = preg_replace(
            '/(href|src)=["\']http:\/\/(127\.0\.0\.1|localhost)\//i',
            '$1="' . $wp_home_trimmed . '/wordpress/',
            $content
        );
    }
    return $content;
}, 999);
