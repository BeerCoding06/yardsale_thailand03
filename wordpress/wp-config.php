<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the website, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', getenv('DB_NAME') ?: 'nuxtcommerce_db' );

/** Database username */
define( 'DB_USER', getenv('DB_USER') ?: 'root' );

/** Database password */
define( 'DB_PASSWORD', getenv('DB_PASSWORD') ?: 'root' );

/** Database hostname */
// define( 'DB_HOST', getenv('DB_HOST') ?: '157.85.98.150:3306' );
define( 'DB_HOST', '157.85.98.150:3306' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * Change these to different unique phrases! You can generate these using
 * the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}.
 *
 * You can change these at any point in time to invalidate all existing cookies.
 * This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'tCBU5acxv rOA HjV*##j{u|N>mX^)Jde8!XCzvpJj}M 3_AE ,^Op!qOxoRGOs=' );
define( 'SECURE_AUTH_KEY',  '2WZrj`EBiX$ONP (M692e&bv$s7[>X?Z<[xlpxcW1PD_,M=9|= 3Kt#l8dwNoI6v' );
define( 'LOGGED_IN_KEY',    'Gqf.^G_vJ#>oP)EXbZkzfW0 a,v>U=]?|[vrFzd<03Z4YtCWluN|yMduq2!?[c.!' );
define( 'NONCE_KEY',        'wZZ}Ay5RF`wnFdn^^._D>P%PbhTzyy%t}%.c9zI@rt&71,-z_|b+8@m{/gIR5-$n' );
define( 'AUTH_SALT',        '}S[jA|Z&Zlj96v33,!]22@MN5Jgi+wGjgpzt06wwi+UlK,)x;3BItSmxD)<{j5px' );
define( 'SECURE_AUTH_SALT', 'fdGb @Sn;^<gT(0D5t:N2Hoxw|EMq&~e;MaXqwx,7j,];LE+JTxlXU6>=1)YU67]' );
define( 'LOGGED_IN_SALT',   '69;Q*wt[4g3 a!dRdW+*nKeX}a+xq[o1I?_&s{T.]4/.{!-+b3yybzu?wPvr92{j' );
define( 'NONCE_SALT',       'mo1r`Qz=mjOdv;$CH F_r8P-R4}YG|}Ghq(aE*0Ov,rC#ma8W]DRzmt]okAr]f6u' );

/**#@-*/

/**
 * WordPress database table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 *
 * At the installation time, database tables are created with the specified prefix.
 * Changing this value after WordPress is installed will make your site think
 * it has not been installed.
 *
 * @link https://developer.wordpress.org/advanced-administration/wordpress/wp-config/#table-prefix
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://developer.wordpress.org/advanced-administration/debug/debug-wordpress/
 */
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );

set_time_limit(300); // 5 นาที
define('WP_MEMORY_LIMIT', '256M'); // เพิ่ม memory limit

/* Add any custom values between this line and the "stop editing" line. */

// ===============================
// Fix HTTPS & Host behind Traefik
// ===============================

// Detect HTTPS from reverse proxy
if (
    isset($_SERVER['HTTP_X_FORWARDED_PROTO']) &&
    $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'
) {
    $_SERVER['HTTPS'] = 'on';
}

// Fix host from proxy
if (isset($_SERVER['HTTP_X_FORWARDED_HOST'])) {
    $_SERVER['HTTP_HOST'] = $_SERVER['HTTP_X_FORWARDED_HOST'];
}

// Determine protocol
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';

// Determine host safely
$host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';

// Define URLs (force override)
define('WP_HOME', getenv('WP_HOME') ?: $protocol . '://' . $host);
define('WP_SITEURL', getenv('WP_SITEURL') ?: $protocol . '://' . $host . '/wordpress');

// Enable Application Passwords for local development (without HTTPS requirement)
define( 'WP_ENVIRONMENT_TYPE', 'local' );

/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
