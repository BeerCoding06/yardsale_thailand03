# Quick Fix: Database Connection Error

## ปัญหา
- API endpoints (`/api/categories`, `/api/products`) return 500 Server Error
- Error: `Database Error` - WordPress cannot connect to MySQL database
- MySQL server rejects connection from IP: `203.114.69.10`

## วิธีแก้ไข

### วิธีที่ 1: ใช้ SQL Script (เร็วที่สุด)

```bash
# 1. Copy SQL script ไปยัง MySQL server
scp fix-database-access-production.sql root@157.85.98.150:/tmp/

# 2. SSH เข้า MySQL server และรัน script
ssh root@157.85.98.150
mysql -u root -p < /tmp/fix-database-access-production.sql
```

### วิธีที่ 2: รัน SQL Commands โดยตรง

```bash
# SSH เข้า MySQL server
ssh root@157.85.98.150

# เข้า MySQL
mysql -u root -p

# รันคำสั่ง SQL
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'203.114.69.10' IDENTIFIED BY 'KtmdoLt9b$n!';
FLUSH PRIVILEGES;
EXIT;
```

### วิธีที่ 3: ใช้ Shell Script

```bash
# รัน script จากเครื่องที่สามารถเชื่อมต่อ MySQL ได้
./fix-database-access-production.sh
```

## ตรวจสอบผลลัพธ์

หลังจากแก้ไขแล้ว:

```bash
# Restart Docker container
docker-compose restart app

# ทดสอบ API
curl http://localhost:8000/api/categories
curl http://localhost:8000/api/products
```

## หมายเหตุ

- ต้องมี SSH access ไปยัง MySQL server (157.85.98.150)
- ต้องรู้ MySQL root password
- ถ้า MySQL server ไม่อนุญาต remote connection อาจต้องแก้ไข `bind-address` ใน MySQL config
