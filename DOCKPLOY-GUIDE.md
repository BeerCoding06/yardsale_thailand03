# คำแนะนำสำหรับ Dockploy Dashboard

## 🔧 แก้ไขปัญหา 127.0.0.1 URLs

### 📋 ขั้นตอนที่ 1: ตรวจสอบและอัปเดต Database URLs

#### 1.1 ตรวจสอบ Database URLs ปัจจุบัน

รัน SQL script นี้ใน MySQL (ผ่าน phpMyAdmin, MySQL Workbench, หรือ terminal):

```sql
USE nuxtcommerce_db;

SELECT 
    option_name, 
    option_value,
    CASE 
        WHEN option_value LIKE '%127.0.0.1%' THEN '❌ NEEDS UPDATE'
        WHEN option_value LIKE '%localhost%' THEN '❌ NEEDS UPDATE'
        ELSE '✅ OK'
    END as status
FROM wp_options 
WHERE option_name IN ('home', 'siteurl')
ORDER BY option_name;
```

#### 1.2 อัปเดต Database URLs

ถ้า database มี `127.0.0.1` หรือ `localhost` ให้รัน SQL script นี้:

```sql
USE nuxtcommerce_db;

-- Update WordPress Home URL
UPDATE wp_options 
SET option_value = 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me' 
WHERE option_name = 'home';

-- Update WordPress Site URL
UPDATE wp_options 
SET option_value = 'http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress' 
WHERE option_name = 'siteurl';

-- Verify the changes
SELECT 
    option_name, 
    option_value 
FROM wp_options 
WHERE option_name IN ('home', 'siteurl');
```

### 📋 ขั้นตอนที่ 2: ใช้ Dockploy Dashboard

#### 2.1 ตรวจสอบ Container Status

1. เปิด Dockploy Dashboard
2. ไปที่หน้า Containers/Applications
3. ตรวจสอบว่า container `app` ทำงานอยู่หรือไม่
4. ถ้าไม่ทำงาน → Start/Restart container

#### 2.2 Restart Container

1. ใน Dockploy Dashboard
2. หา container `app` หรือ `yardsale_thailand03`
3. คลิก "Restart" หรือ "Rebuild & Restart"
4. รอให้ container restart เสร็จ

#### 2.3 ตรวจสอบ Logs (ถ้าจำเป็น)

1. ใน Dockploy Dashboard
2. เปิด Logs ของ container
3. ตรวจสอบว่ามี errors หรือไม่

### 📋 ขั้นตอนที่ 3: ตรวจสอบ Environment Variables

ใน Dockploy Dashboard:

1. ไปที่หน้า Environment Variables หรือ Settings
2. ตรวจสอบว่ามี environment variables เหล่านี้:
   - `WP_HOME=http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me`
   - `WP_SITEURL=http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress`
   - `BASE_URL=http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me`
   - `WP_MEDIA_HOST=http://yardsalethailand-nuxt-8p0ykj-f4d600-157-85-98-150.traefik.me/wordpress`

3. ถ้าไม่มี → เพิ่ม environment variables เหล่านี้
4. Restart container หลังจากเพิ่ม/แก้ไข environment variables

### 📋 ขั้นตอนที่ 4: ตรวจสอบ WordPress URLs (Optional)

ถ้า Dockploy Dashboard มี Terminal/Console:

1. เปิด Terminal/Console ใน Dockploy Dashboard
2. รันคำสั่ง:
   ```bash
   php /app/debug-urls.php
   ```

หรือใช้ SSH เข้า container:

```bash
docker exec -it <container-name> php /app/debug-urls.php
```

### 📋 ขั้นตอนที่ 5: Clear Browser Cache

หลังจากแก้ไขแล้ว:

1. Clear browser cache (Ctrl+Shift+R หรือ Cmd+Shift+R)
2. ตรวจสอบ WordPress login page
3. ตรวจสอบว่า CSS/JS files โหลดได้

## 🔍 Troubleshooting

### ถ้ายังมีปัญหา 127.0.0.1 URLs:

1. **ตรวจสอบ Database**: ใช้ SQL script ในขั้นตอนที่ 1.1
2. **ตรวจสอบ Environment Variables**: ดูขั้นตอนที่ 3
3. **ตรวจสอบ mu-plugin**: ไฟล์ `wordpress/wp-content/mu-plugins/fix-image-urls.php` ต้องมีอยู่
4. **Rebuild Container**: ใน Dockploy Dashboard → Rebuild container

### ถ้า Container ไม่ทำงาน:

1. ตรวจสอบ Logs ใน Dockploy Dashboard
2. ตรวจสอบ Resource Usage (CPU, Memory)
3. ตรวจสอบ Network Settings
4. Restart Container

## 📝 ไฟล์ที่เกี่ยวข้อง

- `update-wordpress-urls.sql` - SQL script สำหรับอัปเดต database
- `check-database-urls.sql` - SQL script สำหรับตรวจสอบ database
- `debug-urls.php` - PHP script สำหรับตรวจสอบ WordPress URLs
- `wordpress/wp-content/mu-plugins/fix-image-urls.php` - MU-plugin สำหรับ replace URLs

## 🚀 Quick Fix

**วิธีเร็วที่สุด:**

1. อัปเดต database ด้วย SQL script (ขั้นตอนที่ 1.2)
2. Restart container ใน Dockploy Dashboard
3. Clear browser cache
4. ตรวจสอบผลลัพธ์
