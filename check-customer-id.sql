-- SQL queries to check customer_id in wp_wc_product_meta_lookup table

-- 1. Check the latest products with customer_id
SELECT product_id, customer_id, sku, stock_status 
FROM wp_wc_product_meta_lookup 
ORDER BY product_id DESC 
LIMIT 10;

-- 2. Check specific product (replace 1161 with your product ID)
-- SELECT product_id, customer_id FROM wp_wc_product_meta_lookup WHERE product_id = 1161;

-- 3. Check all products without customer_id
-- SELECT product_id, customer_id FROM wp_wc_product_meta_lookup WHERE customer_id IS NULL;

-- 4. Check all products with customer_id
-- SELECT product_id, customer_id FROM wp_wc_product_meta_lookup WHERE customer_id IS NOT NULL;

