-- ============================================
-- Fix 127.0.0.1 URLs in WordPress Database
-- ============================================
-- Production URLs
-- WP_HOME: http://www.yardsaleth.com
-- WP_SITEURL: http://www.yardsaleth.com/wordpress
-- ============================================

USE nuxtcommerce_db;

-- 1. ตรวจสอบ URLs ปัจจุบัน
SELECT '=== Current URLs ===' AS info;
SELECT option_name, option_value 
FROM wp_options 
WHERE option_name IN ('home', 'siteurl');

-- 2. แก้ไข siteurl และ home ใน wp_options
UPDATE wp_options 
SET option_value = 'http://www.yardsaleth.com/wordpress' 
WHERE option_name = 'siteurl';

UPDATE wp_options 
SET option_value = 'http://www.yardsaleth.com' 
WHERE option_name = 'home';

-- 3. แทนที่ URLs ทั้งหมดที่มี 127.0.0.1 ใน wp_options
UPDATE wp_options 
SET option_value = REPLACE(option_value, 'http://127.0.0.1/', 'http://www.yardsaleth.com/') 
WHERE option_value LIKE '%127.0.0.1%';

UPDATE wp_options 
SET option_value = REPLACE(option_value, 'http://127.0.0.1:8000/', 'http://www.yardsaleth.com/') 
WHERE option_value LIKE '%127.0.0.1:8000%';

UPDATE wp_options 
SET option_value = REPLACE(option_value, 'http://localhost/', 'http://www.yardsaleth.com/') 
WHERE option_value LIKE '%localhost%';

-- 4. แก้ไข URLs ใน wp_posts (post_content และ guid)
UPDATE wp_posts 
SET post_content = REPLACE(post_content, 'http://127.0.0.1/', 'http://www.yardsaleth.com/') 
WHERE post_content LIKE '%127.0.0.1%';

UPDATE wp_posts 
SET post_content = REPLACE(post_content, 'http://127.0.0.1:8000/', 'http://www.yardsaleth.com/') 
WHERE post_content LIKE '%127.0.0.1:8000%';

UPDATE wp_posts 
SET post_content = REPLACE(post_content, 'http://localhost/', 'http://www.yardsaleth.com/') 
WHERE post_content LIKE '%localhost%';

UPDATE wp_posts 
SET guid = REPLACE(guid, 'http://127.0.0.1/', 'http://www.yardsaleth.com/') 
WHERE guid LIKE '%127.0.0.1%';

UPDATE wp_posts 
SET guid = REPLACE(guid, 'http://127.0.0.1:8000/', 'http://www.yardsaleth.com/') 
WHERE guid LIKE '%127.0.0.1:8000%';

UPDATE wp_posts 
SET guid = REPLACE(guid, 'http://localhost/', 'http://www.yardsaleth.com/') 
WHERE guid LIKE '%localhost%';

-- 5. แก้ไข URLs ใน wp_postmeta
UPDATE wp_postmeta 
SET meta_value = REPLACE(meta_value, 'http://127.0.0.1/', 'http://www.yardsaleth.com/') 
WHERE meta_value LIKE '%127.0.0.1%';

UPDATE wp_postmeta 
SET meta_value = REPLACE(meta_value, 'http://127.0.0.1:8000/', 'http://www.yardsaleth.com/') 
WHERE meta_value LIKE '%127.0.0.1:8000%';

UPDATE wp_postmeta 
SET meta_value = REPLACE(meta_value, 'http://localhost/', 'http://www.yardsaleth.com/') 
WHERE meta_value LIKE '%localhost%';

-- 6. แก้ไข URLs ใน wp_usermeta
UPDATE wp_usermeta 
SET meta_value = REPLACE(meta_value, 'http://127.0.0.1/', 'http://www.yardsaleth.com/') 
WHERE meta_value LIKE '%127.0.0.1%';

UPDATE wp_usermeta 
SET meta_value = REPLACE(meta_value, 'http://127.0.0.1:8000/', 'http://www.yardsaleth.com/') 
WHERE meta_value LIKE '%127.0.0.1:8000%';

UPDATE wp_usermeta 
SET meta_value = REPLACE(meta_value, 'http://localhost/', 'http://www.yardsaleth.com/') 
WHERE meta_value LIKE '%localhost%';

-- 7. ตรวจสอบผลลัพธ์
SELECT '=== Updated URLs ===' AS info;
SELECT option_name, option_value 
FROM wp_options 
WHERE option_name IN ('home', 'siteurl');

-- 8. ตรวจสอบว่ายังมี 127.0.0.1 เหลืออยู่หรือไม่
SELECT '=== Remaining 127.0.0.1 URLs ===' AS info;
SELECT 'wp_options' AS table_name, COUNT(*) AS count 
FROM wp_options 
WHERE option_value LIKE '%127.0.0.1%'
UNION ALL
SELECT 'wp_posts' AS table_name, COUNT(*) AS count 
FROM wp_posts 
WHERE post_content LIKE '%127.0.0.1%' OR guid LIKE '%127.0.0.1%'
UNION ALL
SELECT 'wp_postmeta' AS table_name, COUNT(*) AS count 
FROM wp_postmeta 
WHERE meta_value LIKE '%127.0.0.1%'
UNION ALL
SELECT 'wp_usermeta' AS table_name, COUNT(*) AS count 
FROM wp_usermeta 
WHERE meta_value LIKE '%127.0.0.1%';
