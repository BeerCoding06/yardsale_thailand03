-- Run these commands on your MySQL server (157.85.98.150)
-- Connect via SSH and run: mysql -u root -p

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS nuxtcommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant remote access to root user from any IP (or specific IP: 49.229.213.222)
-- Option 1: Allow from any IP (less secure, but works)
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'%' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- Option 2: Allow from specific IP only (more secure)
-- GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'49.229.213.222' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Verify the database exists
SHOW DATABASES LIKE 'nuxtcommerce_db';

-- Verify user permissions
SELECT user, host FROM mysql.user WHERE user = 'root';
