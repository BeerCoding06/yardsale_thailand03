-- Check existing WordPress database configuration
-- Run this script to verify WordPress database settings

-- Check database exists
SHOW DATABASES LIKE 'nuxtcommerce_db';

-- Use the database
USE nuxtcommerce_db;

-- Check what tables exist (to determine table prefix)
SHOW TABLES;

-- Check WordPress options (home and siteurl)
SELECT option_name, option_value 
FROM wp_options 
WHERE option_name IN ('home', 'siteurl', 'active_plugins', 'template', 'stylesheet');

-- Check WordPress version
SELECT option_value as wp_version 
FROM wp_options 
WHERE option_name = 'db_version';

-- Check if WordPress is installed
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'nuxtcommerce_db' 
AND table_name LIKE 'wp_%';

-- Check table prefix by looking at first table
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'nuxtcommerce_db' 
LIMIT 1;
