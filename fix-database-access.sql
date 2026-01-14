-- ==========================================
-- Fix MySQL Remote Access
-- ==========================================
-- 
-- Container IP ที่ MySQL server เห็น: 49.228.65.203
-- 
-- วิธีใช้:
-- 1. SSH เข้าไปที่ MySQL server: ssh root@157.85.98.150
-- 2. รันคำสั่ง: mysql -u root -p
-- 3. Copy และ paste คำสั่ง SQL ด้านล่างนี้
-- ==========================================

-- สร้าง database (ถ้ายังไม่มี)
CREATE DATABASE IF NOT EXISTS nuxtcommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- วิธีที่ 1: อนุญาตจาก IP เฉพาะ (แนะนำ - ปลอดภัยกว่า)
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'49.228.65.203' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- วิธีที่ 2: อนุญาตจาก IP ใดก็ได้ (ไม่แนะนำ แต่ใช้งานง่าย - ใช้เมื่อวิธีที่ 1 ไม่ได้ผล)
-- GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'%' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- บังคับให้ MySQL ใช้การตั้งค่าใหม่
FLUSH PRIVILEGES;

-- ตรวจสอบว่า database ถูกสร้างแล้ว
SHOW DATABASES LIKE 'nuxtcommerce_db';

-- ตรวจสอบ user permissions
SELECT user, host FROM mysql.user WHERE user = 'root';

-- ตรวจสอบ privileges
SHOW GRANTS FOR 'root'@'49.228.65.203';
