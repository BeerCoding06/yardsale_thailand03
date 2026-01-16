-- Fix MySQL Remote Access for Current Container IP
-- Current Container IP: 49.228.65.203
-- MySQL Server: 157.85.98.150
-- 
-- วิธีใช้:
-- 1. SSH เข้าไปที่ MySQL server: ssh root@157.85.98.150
-- 2. รันคำสั่ง: mysql -u root -p < fix-database-access-current-ip.sql
--    หรือ: mysql -u root -p แล้ว copy/paste คำสั่ง SQL ด้านล่าง
-- ==========================================

-- อนุญาตจาก Current Container IP (49.228.65.203)
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'49.228.65.203' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- วิธีที่ 2: อนุญาตจาก IP ใดก็ได้ (ไม่แนะนำ แต่ใช้งานง่าย - ใช้เมื่อวิธีที่ 1 ไม่ได้ผล)
-- GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'%' IDENTIFIED BY 'KtmdoLt9b$n!' WITH GRANT OPTION;

-- บังคับให้ MySQL ใช้การตั้งค่าใหม่
FLUSH PRIVILEGES;

-- ตรวจสอบ user permissions
SELECT User, Host FROM mysql.user WHERE User = 'root' AND Host LIKE '%49.228.65.203%';

-- ตรวจสอบ privileges
SHOW GRANTS FOR 'root'@'49.228.65.203';
