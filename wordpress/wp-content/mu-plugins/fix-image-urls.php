<?php
/**
 * Plugin Name: Fix Image URLs
 * Description: Replace localhost URLs with correct domain for production
 * Version: 1.0
 * Author: Auto-generated
 */

// Force WordPress to use correct URLs for media files
// This filter replaces localhost URLs with the correct domain
add_filter('wp_get_attachment_url', function($url) {
    if (!$url) return $url;
    
    $wp_home = getenv('WP_HOME') ?: (defined('WP_HOME') ? WP_HOME : '');
    if ($wp_home) {
        // Replace localhost and 127.0.0.1 with correct domain
        $url = str_replace('http://localhost', rtrim($wp_home, '/'), $url);
        $url = str_replace('http://127.0.0.1', rtrim($wp_home, '/'), $url);
        $url = str_replace('https://localhost', rtrim($wp_home, '/'), $url);
        $url = str_replace('https://127.0.0.1', rtrim($wp_home, '/'), $url);
    }
    return $url;
}, 10, 1);

// Also filter image URLs in content and srcset
add_filter('wp_calculate_image_srcset', function($sources) {
    if (!is_array($sources)) return $sources;
    
    $wp_home = getenv('WP_HOME') ?: (defined('WP_HOME') ? WP_HOME : '');
    if ($wp_home) {
        foreach ($sources as &$source) {
            if (isset($source['url']) && strpos($source['url'], 'localhost') !== false) {
                $source['url'] = str_replace('http://localhost', rtrim($wp_home, '/'), $source['url']);
                $source['url'] = str_replace('http://127.0.0.1', rtrim($wp_home, '/'), $source['url']);
                $source['url'] = str_replace('https://localhost', rtrim($wp_home, '/'), $source['url']);
                $source['url'] = str_replace('https://127.0.0.1', rtrim($wp_home, '/'), $source['url']);
            }
        }
    }
    return $sources;
}, 10, 1);

// Filter attachment image src attribute
add_filter('wp_get_attachment_image_src', function($image, $attachment_id, $size, $icon) {
    if (!$image || !is_array($image)) return $image;
    
    $wp_home = getenv('WP_HOME') ?: (defined('WP_HOME') ? WP_HOME : '');
    if ($wp_home && isset($image[0])) {
        $image[0] = str_replace('http://localhost', rtrim($wp_home, '/'), $image[0]);
        $image[0] = str_replace('http://127.0.0.1', rtrim($wp_home, '/'), $image[0]);
        $image[0] = str_replace('https://localhost', rtrim($wp_home, '/'), $image[0]);
        $image[0] = str_replace('https://127.0.0.1', rtrim($wp_home, '/'), $image[0]);
    }
    return $image;
}, 10, 4);
