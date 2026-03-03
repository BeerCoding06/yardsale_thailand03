# www.yardsaleth.com อยู่หลัง Cloudflare – แก้ 404

จาก `nslookup www.yardsaleth.com` ได้ IP **104.21.51.80** และ **172.67.177.100** = โดเมนชี้ไปที่ **Cloudflare** (proxy เปิดอยู่) ไม่ได้ชี้ตรงไปที่เซิร์ฟเวอร์ Dokploy

ดังนั้นต้องตั้งค่าใน **Cloudflare** ให้ส่ง traffic ไปที่ **เซิร์ฟเวอร์ Dokploy จริง** (Origin)

---

## 1. หา IP เซิร์ฟเวอร์ Dokploy

- นี่คือ IP ของเครื่องที่คุณติดตั้ง Dokploy และรัน Docker (VPS เช่น DigitalOcean, Vultr, ฯลฯ)
- ตัวอย่าง: ถ้า deploy บน Vultr อาจได้ `123.45.67.89`

---

## 2. ตั้งค่าใน Cloudflare Dashboard

1. เข้า [dash.cloudflare.com](https://dash.cloudflare.com) → เลือกโดเมน **yardsaleth.com**
2. ไปที่ **DNS** → **Records**
3. หา record ของ **www** (หรือสร้างใหม่):
   - **Type:** `A`
   - **Name:** `www`
   - **Content (IPv4):** ใส่ **IP เซิร์ฟเวอร์ Dokploy** (ไม่ใช่ 104.21 / 172.67)
   - **Proxy status:** 
     - เปิด **Proxied** (เมฆสีส้ม) = ใช้ Cloudflare CDN + SSL
     - หรือปิด **DNS only** (เทา) = ชี้ตรงไปที่ IP นั้น
4. (ถ้าต้องการ) record สำหรับ **@** (yardsaleth.com ไม่มี www):
   - **Type:** `A`
   - **Name:** `@`
   - **Content:** IP เซิร์ฟเวอร์ Dokploy เดียวกัน
   - ใช้ redirect ไป www ได้ในภายหลัง

---

## 3. SSL/TLS (ถ้าใช้ Proxied)

- ไปที่ **SSL/TLS**
- **Encryption mode:** ตั้งเป็น **Full** หรือ **Full (strict)**  
  (ไม่ใช้ Flexible ถ้า origin รองรับ HTTPS)
- ถ้า Dokploy ใช้ Let's Encrypt แล้ว ให้ใช้ **Full (strict)** ได้

---

## 4. รอและทดสอบ

- รอ DNS propagate สัก 1–5 นาที (หรือล้าง cache ใน Cloudflare)
- เปิด **https://www.yardsaleth.com/** และ **https://www.yardsaleth.com/api/health**

ถ้า **Content** ของ record www ใน Cloudflare ยังเป็น IP เก่าหรือผิด (ไม่ใช่ IP เซิร์ฟเวอร์ Dokploy) จะได้ 404 หรือ connection error เพราะ traffic ไปไม่ถึงแอปที่รันบน Dokploy
