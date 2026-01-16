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
    if ($wp_home) {
        $wp_home_trimmed = rtrim($wp_home, '/');
        
        // Replace http://127.0.0.1/wordpress with correct domain
        $url = str_replace('http://127.0.0.1/wordpress', $wp_home_trimmed . '/wordpress', $url);
        $url = str_replace('http://localhost/wordpress', $wp_home_trimmed . '/wordpress', $url);
        
        // Replace http://127.0.0.1 (without /wordpress) with correct domain/wordpress
        $url = str_replace('http://127.0.0.1/', $wp_home_trimmed . '/wordpress/', $url);
        $url = str_replace('http://localhost/', $wp_home_trimmed . '/wordpress/', $url);
        
        // Also handle https
        $url = str_replace('https://127.0.0.1/wordpress', $wp_home_trimmed . '/wordpress', $url);
        $url = str_replace('https://localhost/wordpress', $wp_home_trimmed . '/wordpress', $url);
        $url = str_replace('https://127.0.0.1/', $wp_home_trimmed . '/wordpress/', $url);
        $url = str_replace('https://localhost/', $wp_home_trimmed . '/wordpress/', $url);
    }
    return $url;
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
add_filter('script_loader_src', function($src, $handle) {
    return fix_url($src);
}, 10, 2);

add_filter('style_loader_src', function($src, $handle) {
    return fix_url($src);
}, 10, 2);

// Filter WordPress core URLs
add_filter('site_url', function($url, $path, $scheme, $blog_id) {
    return fix_url($url);
}, 10, 4);

add_filter('home_url', function($url, $path, $scheme, $blog_id) {
    return fix_url($url);
}, 10, 4);

add_filter('content_url', function($url, $path) {
    return fix_url($url);
}, 10, 2);

add_filter('plugins_url', function($url, $path, $plugin) {
    return fix_url($url);
}, 10, 3);

add_filter('includes_url', function($url, $path) {
    return fix_url($url);
}, 10, 2);

add_filter('admin_url', function($url, $path, $blog_id) {
    return fix_url($url);
}, 10, 3);

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
