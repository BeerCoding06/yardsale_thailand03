#!/bin/bash
# Script to check customer_id in database

echo "=== Latest products with customer_id ==="
echo ""
echo "To check in MySQL, run:"
echo "mysql -u root -p [database_name] < check-customer-id.sql"
echo ""
echo "Or connect to MySQL and run:"
echo "SELECT product_id, customer_id FROM wp_wc_product_meta_lookup ORDER BY product_id DESC LIMIT 10;"
echo ""
echo "=== Latest product ID from PHP log ==="
tail -100 /Applications/MAMP/logs/php_error.log | grep "Product created successfully with ID" | tail -1
echo ""
echo "=== Customer ID logs ==="
tail -200 /Applications/MAMP/logs/php_error.log | grep -E "customer_id|Verified customer_id" | tail -10
