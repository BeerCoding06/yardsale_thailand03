# แก้ไขปัญหา Database Connection Error

## ปัญหา
- WordPress Admin: `Error establishing a database connection`
- API endpoints: 500 Server Error
- MySQL server ปฏิเสธการเชื่อมต่อจาก IP: `203.114.69.10`

## วิธีแก้ไข

### วิธีที่ 1: ใช้ SQL Script (แนะนำ)

```bash
# 1. Copy SQL script ไปยัง MySQL server
scp fix-database-access.sql root@157.85.98.150:/tmp/

# 2. SSH เข้า MySQL server และรัน script
ssh root@157.85.98.150
mysql -u root -p < /tmp/fix-database-access.sql
```

### วิธีที่ 2: รัน SQL Commands โดยตรง

```bash
# SSH เข้า MySQL server
ssh root@157.85.98.150

# เข้า MySQL
mysql -u root -p

# รันคำสั่ง SQL (ใส่ password เมื่อถูกถาม)
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'203.114.69.10' IDENTIFIED BY 'KtmdoLt9b$n!';
FLUSH PRIVILEGES;
EXIT;
```

### วิธีที่ 3: อนุญาตจากทุก IP (ไม่แนะนำสำหรับ production)

```bash
mysql -u root -p
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'%' IDENTIFIED BY 'KtmdoLt9b$n!';
FLUSH PRIVILEGES;
EXIT;
```

## ตรวจสอบผลลัพธ์

หลังจากแก้ไขแล้ว:

```bash
# Restart Docker container
docker-compose restart app

# ทดสอบ WordPress Admin
curl -I http://localhost:8000/wordpress/wp-login.php

# ทดสอบ API
curl http://localhost:8000/api/categories
```

## ตรวจสอบเพิ่มเติม

ถ้ายังมีปัญหา ให้ตรวจสอบ:

1. **MySQL bind-address** อนุญาตการเชื่อมต่อจากภายนอก:
   ```bash
   # ตรวจสอบไฟล์ config
   cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address
   # ควรเป็น: bind-address = 0.0.0.0 หรือ comment ออก
   ```

2. **Firewall** เปิด port 3306:
   ```bash
   # ตรวจสอบ firewall
   ufw status | grep 3306
   # หรือ
   iptables -L | grep 3306
   ```

3. **MySQL service** ทำงานอยู่:
   ```bash
   systemctl status mysql
   ```
