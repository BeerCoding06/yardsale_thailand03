# ⚡ Quick Deploy Guide - Deploy เร็วๆ ใน 5 นาที

## 🚀 ขั้นตอนเร็วๆ

### 1. Generate Static Site

```bash
./generate-static.sh
```

หรือ

```bash
NUXT_GENERATE=true pnpm generate
```

### 2. Upload ไฟล์

เข้าไปที่ folder `.output/public/` แล้ว upload ไฟล์ทั้งหมดไปยัง:
- **FZL**: `public_html` หรือ `www` folder
- **วิธี**: ใช้ FTP Client หรือ File Manager ใน Control Panel

### 3. ตั้งค่า Environment Variables

ใน FZL Control Panel → Environment Variables:

```
GQL_HOST=https://your-wordpress-site.com/graphql
WP_MEDIA_HOST=https://your-wordpress-site.com
WP_BASIC_AUTH=your_basic_auth_token
WC_CONSUMER_KEY=your_consumer_key
WC_CONSUMER_SECRET=your_consumer_secret
BASE_URL=https://your-domain.com
```

### 4. สร้างไฟล์ .htaccess

สร้างไฟล์ `.htaccess` ใน `public_html`:

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

### 5. ตรวจสอบ

เปิด browser ไปที่ `https://your-domain.com` ✅

---

## 📚 ต้องการรายละเอียดเพิ่มเติม?

ดูที่ [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) สำหรับคำแนะนำแบบละเอียด

