<?php
/**
 * Plugin Name: Fix Image URLs
 * Description: Replace localhost URLs with correct domain for production
 * Version: 1.0
 * Author: Auto-generated
 */

// Get correct domain from environment variables
$wp_home_env = getenv('WP_HOME');
$wp_home_const = defined('WP_HOME') ? WP_HOME : '';
$wp_home = $wp_home_env ?: $wp_home_const;

if ($wp_home) {
    $wp_home_trimmed = rtrim($wp_home, '/');
    
    // Use output buffering to replace URLs in final HTML output
    // This catches ALL URLs including those generated before filters run
    // Use closure to capture $wp_home_trimmed variable
    $fix_urls_callback = function($buffer) use ($wp_home_trimmed) {
        if (!$wp_home_trimmed) return $buffer;
        
        // Replace all 127.0.0.1 and localhost URLs with Traefik domain
        // Use multiple strategies to catch all variations
        
        // Strategy 1: Simple string replacement (fastest, catches most cases)
        // Replace with /wordpress path preserved - MUST be done first
        $buffer = str_replace('http://127.0.0.1/wordpress/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('http://localhost/wordpress/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('https://127.0.0.1/wordpress/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('https://localhost/wordpress/', $wp_home_trimmed . '/wordpress/', $buffer);
        
        // Also replace without /wordpress prefix (in case some URLs don't have it)
        // But be careful not to double-replace
        $buffer = str_replace('http://127.0.0.1/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('http://localhost/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('https://127.0.0.1/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('https://localhost/', $wp_home_trimmed . '/wordpress/', $buffer);
        
        // Also handle URLs without protocol (relative URLs that got converted)
        $buffer = str_replace('//127.0.0.1/wordpress/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('//localhost/wordpress/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('//127.0.0.1/', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = str_replace('//localhost/', $wp_home_trimmed . '/wordpress/', $buffer);
        
        // Strategy 2: Replace in href and src attributes (more specific)
        $buffer = preg_replace(
            '#(href|src)=["\']https?://(127\.0\.0\.1|localhost)(/[^\s"\'<>]*)?["\']#i',
            '$1="' . $wp_home_trimmed . '$3"',
            $buffer
        );
        
        // Strategy 3: Replace in CSS url() functions
        $buffer = preg_replace(
            '#url\(["\']?https?://(127\.0\.0\.1|localhost)(/[^\s"\'<>\)]*)?["\']?\)#i',
            'url("' . $wp_home_trimmed . '$2")',
            $buffer
        );
        
        // Strategy 4: Replace in JavaScript strings and other contexts
        $buffer = preg_replace(
            '#["\']https?://(127\.0\.0\.1|localhost)(/[^\s"\'<>\)]*)?["\']#i',
            '"' . $wp_home_trimmed . '$2"',
            $buffer
        );
        
        // Strategy 5: Fix duplicate /wordpress/wordpress/ paths (CRITICAL)
        // This must be done AFTER all replacements to catch any duplicates
        $buffer = preg_replace('#(/wordpress/wordpress/)#', '/wordpress/', $buffer);
        $buffer = preg_replace('#(/wordpress/wordpress)#', '/wordpress', $buffer);
        $buffer = preg_replace('#(http://[^/]+/wordpress/wordpress/)#', $wp_home_trimmed . '/wordpress/', $buffer);
        $buffer = preg_replace('#(https://[^/]+/wordpress/wordpress/)#', $wp_home_trimmed . '/wordpress/', $buffer);
        
        // Strategy 6: Final cleanup - replace any remaining localhost/127.0.0.1 with correct domain
        // This catches any URLs that might have been missed
        $buffer = preg_replace(
            '#https?://(127\.0\.0\.1|localhost)(/wordpress/wordpress/)#i',
            $wp_home_trimmed . '/wordpress/',
            $buffer
        );
        $buffer = preg_replace(
            '#https?://(127\.0\.0\.1|localhost)(/wordpress/)#i',
            $wp_home_trimmed . '/wordpress/',
            $buffer
        );
        
        return $buffer;
    };
    
    // Start output buffering IMMEDIATELY (mu-plugins load before WordPress)
    // This ensures we catch ALL output from WordPress
    if (ob_get_level() === 0) {
        ob_start($fix_urls_callback);
    }
    
    // Also register hooks as fallback
    add_action('plugins_loaded', function() use ($fix_urls_callback) {
        if (ob_get_level() === 0) {
            ob_start($fix_urls_callback);
        }
    }, 1);
    
    add_action('init', function() use ($fix_urls_callback) {
        if (ob_get_level() === 0) {
            ob_start($fix_urls_callback);
        }
    }, 1);
    
    // Flush output buffer at the end
    add_action('shutdown', function() {
        while (ob_get_level() > 0) {
            ob_end_flush();
        }
    }, 999);
}

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
        $url = preg_replace('#(/wordpress/wordpress)$#', '/wordpress', $url);
        return $url;
    }
    
    // Fix duplicate /wordpress/wordpress/ BEFORE processing
    $url = preg_replace('#(/wordpress/wordpress/)#', '/wordpress/', $url);
    $url = preg_replace('#(/wordpress/wordpress)$#', '/wordpress', $url);
    
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
    if ($wp_home && $wp_home !== '' && $wp_home !== 'false') {
        // Return environment variable - this will short-circuit database query
        $result = rtrim($wp_home, '/');
        // Force return non-false value to override database
        return $result;
    }
    // Fallback to constant (defined in wp-config.php)
    if (defined('WP_HOME') && WP_HOME !== '' && WP_HOME !== 'false') {
        return rtrim(WP_HOME, '/');
    }
    // Return false to allow WordPress to query database (fallback)
    return false;
}, 1, 3);

add_filter('pre_option_siteurl', function($pre, $option, $default_value) {
    // Priority: 1. Environment variable (from docker-compose.yml), 2. Constant, 3. Database
    $wp_siteurl = getenv('WP_SITEURL');
    if ($wp_siteurl && $wp_siteurl !== '' && $wp_siteurl !== 'false') {
        // Return environment variable - this will short-circuit database query
        $result = rtrim($wp_siteurl, '/');
        // Force return non-false value to override database
        return $result;
    }
    // Fallback to constant (defined in wp-config.php)
    if (defined('WP_SITEURL') && WP_SITEURL !== '' && WP_SITEURL !== 'false') {
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
