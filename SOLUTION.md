# วิธีแก้ไขปัญหา Database Connection Error

## ปัญหา
- PHP API return 500 Internal Server Error
- Error: "Error establishing a database connection"
- MySQL server ปฏิเสธการเชื่อมต่อจาก IP: `203.114.69.10`

## สาเหตุ
- MySQL permissions ไม่ถูกต้อง
- Database `nuxtcommerce_db` อาจจะยังมีอยู่ แต่ไม่สามารถเข้าถึงได้

## วิธีแก้ไข

### ขั้นตอนที่ 1: SSH เข้า MySQL Server

```bash
ssh root@157.85.98.150
```

### ขั้นตอนที่ 2: รัน SQL Script

```bash
# Copy script ไปยัง MySQL server
scp fix-database-access.sql root@157.85.98.150:/tmp/

# SSH และรัน script
ssh root@157.85.98.150
mysql -u root -p < /tmp/fix-database-access.sql
```

### หรือรัน SQL Commands โดยตรง:

```bash
mysql -u root -p

# รันคำสั่ง SQL
GRANT ALL PRIVILEGES ON nuxtcommerce_db.* TO 'root'@'203.114.69.10' IDENTIFIED BY 'KtmdoLt9b$n!';
FLUSH PRIVILEGES;
EXIT;
```

### ขั้นตอนที่ 3: ตรวจสอบผลลัพธ์

```bash
# Restart Docker container
docker-compose restart app

# ทดสอบ API
curl http://localhost:8000/api/categories
curl http://localhost:8000/api/products
```

## หมายเหตุ
- ต้องมี SSH access ไปยัง MySQL server
- ต้องรู้ MySQL root password
- หลังจากแก้ไขแล้ว ทั้ง WordPress Admin และ API endpoints จะทำงานได้ปกติ
