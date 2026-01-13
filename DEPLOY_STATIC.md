# คำแนะนำการ Generate Static Site สำหรับ FZL

> **หมายเหตุ**: สำหรับคำแนะนำการ Deploy แบบละเอียด ดูที่ [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)

## ข้อกำหนดเบื้องต้น

- Node.js version 16.14 หรือสูงกว่า (แนะนำ Node.js 18+ หรือ 20+)
- pnpm version ตามที่ระบุใน package.json

## ขั้นตอนการ Generate Static Site

### 1. ตรวจสอบ Node.js Version

```bash
node --version
```

ถ้า version ต่ำกว่า 16.14 ให้อัปเดต Node.js ก่อน

### 2. ติดตั้ง Dependencies (ถ้ายังไม่ได้ติดตั้ง)

```bash
pnpm install
```

### 3. Generate Static Site

```bash
pnpm generate
```

หรือ

```bash
npm run generate
```

### 4. ไฟล์ที่ Generate จะอยู่ในโฟลเดอร์ `.output/public`

หลังจาก generate เสร็จแล้ว ไฟล์ static ทั้งหมดจะอยู่ใน:
```
.output/public/
```

## การ Deploy ไปยัง FZL

### วิธีที่ 1: Upload ผ่าน FTP/File Manager

1. เข้าไปที่ `.output/public` folder
2. Upload ไฟล์ทั้งหมดในโฟลเดอร์นี้ไปยัง public_html หรือ www ของ FZL
3. ตรวจสอบว่าไฟล์ `.htaccess` (ถ้ามี) ถูก upload ด้วย

### วิธีที่ 2: ใช้ Git (ถ้า FZL รองรับ)

1. Commit และ push โค้ดไปยัง Git repository
2. ตั้งค่า build command ใน FZL:
   - Build command: `pnpm generate`
   - Output directory: `.output/public`

### วิธีที่ 3: ใช้ CI/CD

1. ตั้งค่า GitHub Actions หรือ CI/CD อื่นๆ
2. Build และ generate static files
3. Deploy ไปยัง FZL

## ไฟล์ที่ต้อง Upload

หลังจาก generate แล้ว ให้ upload ไฟล์ทั้งหมดใน `.output/public/` ไปยัง:

- `/public_html/` หรือ
- `/www/` หรือ
- `/htdocs/`

## หมายเหตุสำคัญ

1. **API Routes**: เนื่องจากเป็น static site API routes ที่อยู่ใน `/server/api/` จะไม่ทำงาน ต้องใช้ backend API แยก หรือใช้ WordPress/WooCommerce API โดยตรง

2. **Environment Variables**: ต้องตั้งค่า environment variables ใน FZL (ถ้ามี):
   - `GQL_HOST`
   - `WP_MEDIA_HOST`
   - `WP_BASIC_AUTH`
   - `WC_CONSUMER_KEY`
   - `WC_CONSUMER_SECRET`
   - `BASE_URL`

3. **Dynamic Routes**: หน้า dynamic routes เช่น `/order/[id]`, `/product/[id]` จะถูก generate เป็น static HTML ตาม routes ที่พบในระหว่าง build

4. **i18n**: ภาษาไทยและภาษาอื่นๆ จะถูก generate เป็น static pages ตามที่ตั้งค่าไว้

## Troubleshooting

### ถ้า generate ไม่สำเร็จ

1. ตรวจสอบ Node.js version
2. ลบ `node_modules` และ `.output` แล้วติดตั้งใหม่:
   ```bash
   rm -rf node_modules .output
   pnpm install
   pnpm generate
   ```

### ถ้า static site ไม่ทำงาน

1. ตรวจสอบว่า upload ไฟล์ทั้งหมดใน `.output/public/` แล้ว
2. ตรวจสอบ `.htaccess` หรือ server configuration
3. ตรวจสอบ BASE_URL ใน environment variables

## สร้างไฟล์ .htaccess สำหรับ Static Site (ถ้าจำเป็น)

สร้างไฟล์ `.htaccess` ใน `.output/public/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

