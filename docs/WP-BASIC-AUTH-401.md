# แก้ error จาก WordPress / WooCommerce API

## 503 – Briefly unavailable for scheduled maintenance

เมื่อได้ `"http_code": 503` และข้อความ **"Briefly unavailable for scheduled maintenance. Check back in a minute."**

WordPress อยู่โหมด **maintenance** (อัปเดตหรือมีไฟล์ `.maintenance` ค้างอยู่)

**แก้ที่เซิร์ฟเวอร์ WordPress (cms.yardsaleth.com):**

1. **รอ 1–2 นาที** ถ้ากำลังอัปเดต plugin/theme/core อยู่
2. ถ้ารอนานแล้วยัง 503 อยู่ ให้ **ลบไฟล์ `.maintenance`** ใน root ของ WordPress (โฟลเดอร์ที่ติดตั้ง WP):
   ```bash
   # SSH เข้าเซิร์ฟเวอร์ cms แล้ว
   cd /path/to/wordpress   # เช่น /var/www/html หรือที่ติดตั้ง WP
   rm -f .maintenance
   ```
   จากนั้นลองเรียก API อีกครั้ง

---

## 401 – Authentication failed (WooCommerce API)

เมื่อ API products, categories หรือ **product detail (getProduct)** คืน `401` (woocommerce_rest_cannot_view หรือ "คุณไม่มีสิทธิ์ในการดูข้อมูลนี้")

---

## 1. ให้ request ไปที่ WordPress จริง (ไม่ใช่ proxy)

ถ้าใน `debug.url` เป็น **https://www.yardsaleth.com/wordpress/...** หรือ **http://157.85.98.150:8080** แปลว่าตั้งผิด

- **WP_BASE_URL** ต้องเป็น URL ของ **WordPress/CMS จริง** เท่านั้น เช่น:
  - `WP_BASE_URL=https://cms.yardsaleth.com`
- **ห้ามใช้** URL proxy ฝั่ง Nuxt เช่น `https://www.yardsaleth.com/wordpress`
- ตั้งใน **environment ที่รันแอป** (Docker/Dokploy) แล้ว **restart / redeploy**

---

## 2. ตั้งค่า WP_BASIC_AUTH ให้ถูกต้อง

WooCommerce ต้องการ **Application Password** ของ WordPress (ไม่ใช่รหัสเข้าเว็บปกติ)

### สร้าง Application Password ใน WordPress (cms.yardsaleth.com)

1. Login เข้า **https://cms.yardsaleth.com/wp-admin**
2. ไปที่ **Users → Profile** (หรือผู้ใช้ที่ต้องการ)
3. เลื่อนลงถึง **Application Passwords**
4. ใส่ **New Application Password Name** (เช่น `nuxt-api`) → **Add New Application Password**
5. WordPress จะแสดงรหัสแบบ **xxxx xxxx xxxx xxxx xxxx xxxx** (มีช่องว่าง) — ** copy ไว้ครั้งเดียว** (จะไม่แสดงอีก)

### ตั้งค่าในแอป

ใน `.env` หรือ Environment ของ deployment:

```env
WP_BASIC_AUTH=username:application_password
```

- **username** = ชื่อผู้ใช้ WordPress (เช่น `admin` หรืออีเมลที่ใช้ login)
- **application_password** = รหัสที่ copy มา **เอาช่องว่างออก** (หรือลองแบบมีช่องว่างใน quotes)

ตัวอย่าง:

```env
WP_BASIC_AUTH=admin:abcd1234efgh5678ijkl
```

ถ้าใช้ base64 (ไม่บังคับ):

```bash
echo -n "admin:your_app_password" | base64
# ใส่ค่าที่ได้ใน WP_BASIC_AUTH
```

### เช็กเพิ่มเติม

- ผู้ใช้ WordPress ต้องมีสิทธิ์อ่าน (อย่างน้อย) และถ้าใช้ WooCommerce ต้องใช้ user ที่มีสิทธิ์จัดการ WooCommerce
- ถ้าเปลี่ยนไปใช้ **cms.yardsaleth.com** ต้องสร้าง Application Password **บน WordPress ที่ cms.yardsaleth.com** (ไม่ใช้ของ 157.85.98.150 ตัวเก่า)

---

## 3. ใช้ Consumer Key / Secret (แนะนำ – แก้ 401 ได้)

Products, Categories และ **Product detail (หน้า /product/xxx)** ใช้ **consumer_key + consumer_secret** จาก WooCommerce:

- `WP_CONSUMER_KEY=ck_...`
- `WP_CONSUMER_SECRET=cs_...`

ใส่ใน `.env` หรือ Environment ของ Dockploy แล้ว redeploy

- ถ้าใช้แค่ Basic Auth แล้วเจอ 401 ใน product detail โค้ดจะลองใช้ consumer key/secret ให้แล้ว (ทั้ง PHP และ fallback ใน Node)
- แนะนำให้ตั้ง **ทั้งสองชุด** (WP_BASIC_AUTH สำหรับ orders/สร้างสินค้า และ WP_CONSUMER_KEY/SECRET สำหรับดู products/product detail)

## 4. Login ไม่ทำงาน

ระบบ login ใช้ **JWT** ที่ WordPress (cms.yardsaleth.com):

- ต้องมี **WP_BASE_URL** ใน Environment (หรือ .env) ให้ชี้ไปที่ WordPress จริง เช่น `https://cms.yardsaleth.com`
- บน WordPress ต้องติดตั้ง plugin **JWT Authentication for WP REST API** และเปิด endpoint `/wp-json/jwt-auth/v1/token`
- ใน **wp-config.php** (บน WordPress) ต้องกำหนด **JWT secret** ก่อนบรรทัด "That's all, stop editing!":
  ```php
  define('JWT_AUTH_SECRET_KEY', 'ใส่รหัสลับยาวๆ สุ่ม เช่น จาก wp generator หรือ openssl');
  ```
  รหัสนี้ใช้ sign/verify token — **อย่า commit ค่าจริงลง git** เก็บแค่ใน wp-config บนเซิร์ฟเวอร์
- ถ้าไม่มี JWT จะ fallback ไปใช้การตรวจรหัสผ่านผ่าน DB (ต้องมี wp-load.php และการเชื่อม DB ถูกต้อง)

ถ้า login แล้วได้ "Invalid username or password" ให้ตรวจ: 1) WP_BASE_URL ถูกต้อง 2) มี plugin JWT + JWT_AUTH_SECRET_KEY ใน wp-config 3) ชื่อผู้ใช้/รหัสผ่านถูกต้อง

## 5. สรุป

| อาการ | แก้ไข |
|--------|--------|
| `debug.url` เป็น www.yardsaleth.com/wordpress หรือ 157.85.98.150 | ตั้ง `WP_BASE_URL=https://cms.yardsaleth.com` (ไม่ใช่ .../wordpress) แล้ว restart/redeploy |
| 401 กับ products/categories | ตั้ง `WP_CONSUMER_KEY` และ `WP_CONSUMER_SECRET` จาก WooCommerce REST API |
| 401 กับ endpoint อื่น (orders, create product ฯลฯ) | ตั้ง `WP_BASIC_AUTH=username:application_password` (Application Passwords ใน WordPress) |
| Login ไม่เข้า / ไม่ทำงาน | ตั้ง `WP_BASE_URL` ให้ชี้ไปที่ WordPress และตรวจว่า JWT plugin ทำงานที่ cms |
