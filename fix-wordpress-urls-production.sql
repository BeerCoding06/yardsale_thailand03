-- Fix WordPress URLs in database for Production
-- This script updates WordPress URLs to use the domain from request headers
-- Run this script on MySQL server to update WordPress URLs

-- Note: After running this, WordPress will auto-detect URLs from request headers
-- But we need to set initial values in the database

-- Update WordPress Home URL (use your production domain)
-- Replace 'your-production-domain.com' with your actual domain
UPDATE wp_options SET option_value='http://your-production-domain.com' WHERE option_name='home';

-- Update WordPress Site URL (use your production domain)
-- Replace 'your-production-domain.com' with your actual domain
UPDATE wp_options SET option_value='http://your-production-domain.com/wordpress' WHERE option_name='siteurl';

-- Verify the changes
SELECT option_name, option_value FROM wp_options WHERE option_name IN ('home', 'siteurl');

-- Alternative: If using Traefik domain (example)
-- UPDATE wp_options SET option_value='http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me' WHERE option_name='home';
-- UPDATE wp_options SET option_value='http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress' WHERE option_name='siteurl';
