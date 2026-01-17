-- Fix WordPress URLs in database for Production
-- Run this script on MySQL server to update WordPress URLs

-- Update WordPress Home URL (use Traefik domain)
UPDATE wp_options SET option_value='http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me' WHERE option_name='home';

-- Update WordPress Site URL (use Traefik domain)
UPDATE wp_options SET option_value='http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress' WHERE option_name='siteurl';

-- Verify the changes
SELECT option_name, option_value FROM wp_options WHERE option_name IN ('home', 'siteurl');
