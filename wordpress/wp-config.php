<?php
/**
 * Clean wp-config.php for Docker + Traefik (Production Safe)
 */

/* ===============================
 * Database
 * =============================== */
define('DB_NAME',     getenv('DB_NAME'));
define('DB_USER',     getenv('DB_USER'));
define('DB_PASSWORD', getenv('DB_PASSWORD'));
define('DB_HOST',     getenv('DB_HOST'));

define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

/* ===============================
 * Authentication Keys & Salts
 * =============================== */
define('AUTH_KEY',         'PUT_YOUR_KEY_HERE');
define('SECURE_AUTH_KEY',  'PUT_YOUR_KEY_HERE');
define('LOGGED_IN_KEY',    'PUT_YOUR_KEY_HERE');
define('NONCE_KEY',        'PUT_YOUR_KEY_HERE');
define('AUTH_SALT',        'PUT_YOUR_KEY_HERE');
define('SECURE_AUTH_SALT', 'PUT_YOUR_KEY_HERE');
define('LOGGED_IN_SALT',   'PUT_YOUR_KEY_HERE');
define('NONCE_SALT',       'PUT_YOUR_KEY_HERE');

/* ===============================
 * Table Prefix
 * =============================== */
$table_prefix = 'wp_';

/* ===============================
 * Debug
 * =============================== */
define('WP_DEBUG', false);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);

/* ===============================
 * Environment
 * =============================== */
define('WP_ENVIRONMENT_TYPE', 'production');

/* ===============================
 * Reverse Proxy (Traefik)
 * =============================== */
if (
    isset($_SERVER['HTTP_X_FORWARDED_PROTO']) &&
    $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'
) {
    $_SERVER['HTTPS'] = 'on';
}

/* ===============================
 * WordPress URLs (FIXED, NO AUTO)
 * =============================== */
if (!getenv('WP_HOME') || !getenv('WP_SITEURL')) {
    die('WP_HOME and WP_SITEURL environment variables are required.');
}

define('WP_HOME', getenv('WP_HOME'));
define('WP_SITEURL', getenv('WP_SITEURL'));

/* ===============================
 * Cookies (subdomain safe)
 * =============================== */
define('COOKIE_DOMAIN', '');
define('COOKIEPATH', '/wordpress/');
define('SITECOOKIEPATH', '/wordpress/');
define('ADMIN_COOKIE_PATH', '/wordpress/wp-admin/');

/* ===============================
 * Performance
 * =============================== */
define('WP_MEMORY_LIMIT', '256M');
set_time_limit(300);

/* ===============================
 * Absolute Path
 * =============================== */
if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

/* ===============================
 * Bootstrap WordPress
 * =============================== */
require_once ABSPATH . 'wp-settings.php';
