-- Check current WordPress URLs in database
-- Run this to see what values are currently stored

USE nuxtcommerce_db;

-- Check current URLs
SELECT 
    option_name, 
    option_value,
    CASE 
        WHEN option_value LIKE '%127.0.0.1%' THEN '❌ NEEDS UPDATE'
        WHEN option_value LIKE '%localhost%' THEN '❌ NEEDS UPDATE'
        ELSE '✅ OK'
    END as status
FROM wp_options 
WHERE option_name IN ('home', 'siteurl')
ORDER BY option_name;
