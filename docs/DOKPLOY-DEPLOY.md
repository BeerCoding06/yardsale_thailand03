# Deploy บน Dokploy + ผูก www.yardsaleth.com

## 1. สิ่งที่ต้องมี

- เซิร์ฟเวอร์ที่ติดตั้ง [Dokploy](https://dokploy.com) แล้ว (หรือรัน `curl -sSL https://dokploy.com/install.sh | sh`)
- DNS ชี้แล้ว:
  - **A record** `www.yardsaleth.com` → IP ของเซิร์ฟเวอร์ Dokploy
  - **A record** `yardsaleth.com` → IP เดียวกัน (ใช้ redirect ไป www)

## 2. Deploy โปรเจกต์ใน Dokploy

1. เข้า Dokploy Dashboard (เช่น `http://your-server-ip:3000`)
2. สร้าง **Docker Compose** deployment ใหม่
3. อัปโหลดหรือเชื่อม repo ที่มีไฟล์นี้ แล้วเลือก:
   - **docker-compose.yml** (ใน root โปรเจกต์)
   - **Dockerfile.prod**
4. ใส่ **Environment** ถ้าต้องการ override (หรือใช้ `.env` ใน repo)
5. กด Deploy

## 3. ผูกโดเมน (เลือกอย่างใดอย่างหนึ่ง)

### วิธี A: ใช้ Traefik labels ใน docker-compose (ทำไว้ให้แล้ว)

ไฟล์ `docker-compose.yml` มี labels สำหรับ:

- **https://www.yardsaleth.com** → ส่งไปที่แอป Nuxt (port 3000)
- **https://yardsaleth.com** → redirect ไป https://www.yardsaleth.com
- HTTPS ผ่าน **Let's Encrypt** (certResolver=letsencrypt)

ต้องมี **network ชื่อ `dokploy-network`** ใน Dokploy (โดยปกติสร้างให้อยู่แล้ว)

### วิธี B: ใช้ Dokploy Domains UI (ไม่ต้องพึ่ง labels)

1. ใน Dokploy ไปที่ deployment นี้ → **Domains** (หรือ Settings → Domains)
2. เพิ่มโดเมน:
   - **Host:** `www.yardsaleth.com`
   - **Container Port:** `3000`
   - เปิด **HTTPS** และเลือก **Let's Encrypt**
3. (ถ้าต้องการ) เพิ่ม `yardsaleth.com` แล้วตั้ง redirect ไป www ตามที่ Dokploy รองรับ

ถ้าใช้วิธี B อาจปิดหรือลบ Traefik labels ใน `docker-compose.yml` เพื่อไม่ให้ซ้ำ

## 4. ตรวจหลัง deploy

- เปิด **https://www.yardsaleth.com/** ควรเห็นหน้า Nuxt
- เปิด **https://www.yardsaleth.com/api/health** ควรได้ JSON
- เปิด **https://yardsaleth.com/** ควรถูก redirect ไป www

ถ้าได้ 404 ให้ดู `docs/TROUBLESHOOTING-404.md`

---

## 5. WordPress + Database (WP / MySQL)

แอปเชื่อม **สองที่**: WordPress (WooCommerce API) และ MySQL (ข้อมูลของ Nuxt เอง)

### ไม่ต้องแก้ ถ้า

- WordPress ยังอยู่ที่ **http://157.85.98.150:8080**
- MySQL ยังอยู่ที่ **157.85.98.150:3306**
- เซิร์ฟเวอร์ Dokploy **เข้าถึง IP 157.85.98.150 ได้** (เปิด firewall ไปที่พอร์ต 8080 และ 3306)

### ต้องแก้ใน `.env` หรือ Environment ใน Dokploy ถ้า

| กรณี | แก้ตัวแปร |
|------|-------------|
| ย้าย WordPress ไปโดเมน/โฮสต์ใหม่ | `WP_BASE_URL=https://โดเมน-wordpress ของคุณ` |
| MySQL อยู่คนละเครื่อง/พอร์ต | `DB_HOST=โฮสต์:พอร์ต`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| MySQL ตั้งรหัสผ่านแล้ว | `DB_PASSWORD=รหัสผ่านที่ตั้งไว้` |

### เครือข่าย

ถ้า Dokploy รันบน **คนละเครื่อง** กับ 157.85.98.150 ต้องให้เครื่อง Dokploy **ออกเน็ตไปที่ IP นั้นได้** (เปิด firewall / security group สำหรับพอร์ต 8080 และ 3306 จาก IP ของ Dokploy ไปที่ 157.85.98.150)
