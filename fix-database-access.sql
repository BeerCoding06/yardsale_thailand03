-- ==========================================
-- Fix MySQL Remote Access for Production
-- ==========================================
-- 
-- Production Server IP: 203.114.69.10
-- MySQL Server: 157.85.98.150
-- 
-- วิธีใช้:
-- 1. SSH เข้าไปที่ MySQL server: ssh root@157.85.98.150
-- 2. รันคำสั่ง: mysql -u root -p < fix-database-access.sql
--    หรือ: mysql -u root -p แล้ว copy/paste คำสั่ง SQL ด้านล่าง
-- ==========================================

-- สร้าง database (ถ้ายังไม่มี)
CREATE DATABASE IF NOT EXISTS nuxtcommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- อนุญาตจาก Production Server IP (203.114.69.10)
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'203.114.69.10' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- วิธีที่ 2: อนุญาตจาก IP ใดก็ได้ (ไม่แนะนำ แต่ใช้งานง่าย - ใช้เมื่อวิธีที่ 1 ไม่ได้ผล)
-- GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'%' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- บังคับให้ MySQL ใช้การตั้งค่าใหม่
FLUSH PRIVILEGES;

-- ตรวจสอบว่า database ถูกสร้างแล้ว
SHOW DATABASES LIKE 'nuxtcommerce_db';

-- ตรวจสอบ user permissions
SELECT User, Host FROM mysql.user WHERE User = 'root' AND Host LIKE '%203.114.69.10%';

-- ตรวจสอบ privileges
SHOW GRANTS FOR 'root'@'203.114.69.10';
