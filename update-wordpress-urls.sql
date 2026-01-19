-- Update WordPress URLs in database
-- Run this script on MySQL server to fix 127.0.0.1 URLs

USE nuxtcommerce_db;

-- 1. Check current URLs in database
SELECT 
    option_name, 
    option_value 
FROM wp_options 
WHERE option_name IN ('home', 'siteurl');

-- 2. Update WordPress Home URL (use Traefik domain)
UPDATE wp_options 
SET option_value = 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me' 
WHERE option_name = 'home';

-- 3. Update WordPress Site URL (use Traefik domain with /wordpress path)
UPDATE wp_options 
SET option_value = 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress' 
WHERE option_name = 'siteurl';

-- 4. Verify the changes
SELECT 
    option_name, 
    option_value 
FROM wp_options 
WHERE option_name IN ('home', 'siteurl');
