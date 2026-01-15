-- Fix WordPress URLs in database
-- Run this script on MySQL server to update WordPress URLs

-- Update WordPress Home URL
UPDATE wp_options SET option_value='http://localhost:8000' WHERE option_name='home';

-- Update WordPress Site URL
UPDATE wp_options SET option_value='http://localhost:8000/wordpress' WHERE option_name='siteurl';

-- Verify the changes
SELECT option_name, option_value FROM wp_options WHERE option_name IN ('home', 'siteurl');
