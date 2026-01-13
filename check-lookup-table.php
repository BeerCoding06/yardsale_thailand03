<?php
// Check lookup table for product 1207

// Load WordPress
$wp_load_path = dirname(__FILE__) . '/wordpress/wp-load.php';
if (!file_exists($wp_load_path)) {
    $wp_load_path = dirname(__FILE__, 2) . '/wordpress/wp-load.php';
}
if (!file_exists($wp_load_path)) {
    $wp_load_path = dirname(__FILE__, 3) . '/wordpress/wp-load.php';
}

if (!file_exists($wp_load_path)) {
    echo "WordPress not found.\n";
    exit(1);
}

require_once $wp_load_path;

$product_id = 1207;

global $wpdb;
$lookup_table = $wpdb->prefix . 'wc_product_meta_lookup';

// Check lookup table
$lookup_data = $wpdb->get_row($wpdb->prepare(
    "SELECT * FROM {$lookup_table} WHERE product_id = %d",
    $product_id
), ARRAY_A);

echo "Product ID: $product_id\n";
echo "\nLookup Table Data:\n";
print_r($lookup_data);

// Check postmeta for prices
$regular_price = get_post_meta($product_id, '_regular_price', true);
$sale_price = get_post_meta($product_id, '_sale_price', true);
$price = get_post_meta($product_id, '_price', true);

echo "\nPost Meta Prices:\n";
echo "Regular Price: $regular_price\n";
echo "Sale Price: $sale_price\n";
echo "Price: $price\n";

// Check WooCommerce product
if (function_exists('wc_get_product')) {
    $product = wc_get_product($product_id);
    if ($product) {
        echo "\nWooCommerce Product Prices:\n";
        echo "Regular Price: " . $product->get_regular_price() . "\n";
        echo "Sale Price: " . $product->get_sale_price() . "\n";
        echo "Price: " . $product->get_price() . "\n";
    }
}

