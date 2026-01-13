# 📚 คู่มือการ Deploy Project ไปยัง FZL

## 📋 สารบัญ
1. [เตรียมความพร้อม](#เตรียมความพร้อม)
2. [Generate Static Site](#generate-static-site)
3. [Upload ไปยัง FZL](#upload-ไปยัง-fzl)
4. [ตั้งค่า Environment Variables](#ตั้งค่า-environment-variables)
5. [ตรวจสอบหลัง Deploy](#ตรวจสอบหลัง-deploy)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 เตรียมความพร้อม

### 1. ตรวจสอบ Node.js Version

```bash
node --version
```

**ต้องใช้ Node.js version 16.14 หรือสูงกว่า** (แนะนำ Node.js 18+ หรือ 20+)

ถ้า version ต่ำกว่า ให้อัปเดต:
- **macOS**: ใช้ `nvm` หรือดาวน์โหลดจาก [nodejs.org](https://nodejs.org)
- **Windows**: ดาวน์โหลดจาก [nodejs.org](https://nodejs.org)

### 2. ติดตั้ง Dependencies

```bash
# ใช้ pnpm (แนะนำ)
pnpm install

# หรือใช้ npm
npm install
```

### 3. ตรวจสอบ Environment Variables

สร้างไฟล์ `.env` (ถ้ายังไม่มี) และตั้งค่า:

```env
GQL_HOST=https://your-wordpress-site.com/graphql
WP_MEDIA_HOST=https://your-wordpress-site.com
WP_BASIC_AUTH=your_basic_auth_token
WC_CONSUMER_KEY=your_consumer_key
WC_CONSUMER_SECRET=your_consumer_secret
BASE_URL=https://your-domain.com
```

**หมายเหตุ**: ไฟล์ `.env` จะไม่ถูก upload ไปยัง hosting แต่ต้องตั้งค่าใน hosting control panel

---

## 🔨 Generate Static Site

### วิธีที่ 1: ใช้ Script (แนะนำ)

```bash
./generate-static.sh
```

### วิธีที่ 2: ใช้คำสั่งโดยตรง

```bash
# ใช้ pnpm
NUXT_GENERATE=true pnpm generate

# หรือใช้ npm
NUXT_GENERATE=true npm run generate
```

### 3. ตรวจสอบผลลัพธ์

หลังจาก generate เสร็จ ไฟล์จะอยู่ใน:
```
.output/public/
```

ตรวจสอบว่าไฟล์ถูกสร้างแล้ว:
```bash
ls -la .output/public/
```

ควรเห็นไฟล์:
- `index.html`
- `_nuxt/` (folder สำหรับ assets)
- `sitemap.xml`
- `robots.txt`
- และไฟล์อื่นๆ

---

## 📤 Upload ไปยัง FZL

### วิธีที่ 1: ใช้ FTP Client (แนะนำสำหรับผู้เริ่มต้น)

#### ขั้นตอน:

1. **เตรียมไฟล์**
   - เข้าไปที่ folder `.output/public/`
   - เลือกไฟล์ทั้งหมดใน folder นี้

2. **เชื่อมต่อ FTP**
   - ใช้ FTP Client เช่น:
     - **FileZilla** (ฟรี, ใช้ได้ทุก OS)
     - **Cyberduck** (ฟรี, macOS/Windows)
     - **WinSCP** (ฟรี, Windows)
   
   - ข้อมูลที่ต้องใช้:
     - **Host**: ftp.your-domain.com หรือ IP address
     - **Username**: username ที่ FZL ให้มา
     - **Password**: password ที่ FZL ให้มา
     - **Port**: 21 (FTP) หรือ 22 (SFTP)

3. **Upload ไฟล์**
   - เชื่อมต่อ FTP
   - ไปที่ folder `public_html` หรือ `www` หรือ `htdocs`
   - Upload ไฟล์ทั้งหมดจาก `.output/public/` ไปยัง folder นี้
   - **สำคัญ**: Upload ทั้ง folder `_nuxt` ด้วย

4. **ตรวจสอบสิทธิ์ไฟล์**
   - ตั้งค่า permissions:
     - **Folders**: 755
     - **Files**: 644

### วิธีที่ 2: ใช้ File Manager ใน Control Panel

1. **เข้าสู่ระบบ FZL Control Panel**
   - ไปที่ control panel ของ FZL
   - Login ด้วย username และ password

2. **เปิด File Manager**
   - หา "File Manager" หรือ "จัดการไฟล์"
   - ไปที่ folder `public_html` หรือ `www`

3. **Upload ไฟล์**
   - กดปุ่ม "Upload" หรือ "อัปโหลด"
   - เลือกไฟล์ทั้งหมดจาก `.output/public/`
   - รอให้ upload เสร็จ

4. **ตรวจสอบ**
   - ตรวจสอบว่าไฟล์ถูก upload ครบถ้วน
   - โดยเฉพาะ folder `_nuxt` ต้องมีอยู่

### วิธีที่ 3: ใช้ Git Auto-Deploy (ถ้า FZL รองรับ)

**คำตอบ**: ใช่! หลังจากตั้งค่าเสร็จแล้ว เมื่อคุณ push code ไปยัง Git repository FZL จะ:
1. **ดึงโค้ดใหม่** จาก Git repository
2. **รัน Build Command** ที่ตั้งค่าไว้ (เช่น `NUXT_GENERATE=true pnpm generate`)
3. **Deploy ไฟล์** จาก Output Directory ไปยัง public_html อัตโนมัติ

#### ขั้นตอนการตั้งค่า:

1. **เตรียม Git Repository**
   ```bash
   # ตรวจสอบว่าเป็น Git repository แล้วหรือยัง
   git status
   
   # ถ้ายังไม่ได้ initialize
   git init
   git add .
   git commit -m "Initial commit"
   
   # เชื่อมต่อกับ remote repository (GitHub, GitLab, Bitbucket)
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```

2. **ตั้งค่าใน FZL Control Panel**
   
   **เข้าไปที่ FZL Control Panel:**
   - หาเมนู **"Git Deploy"** หรือ **"Auto Deploy"** หรือ **"Deploy from Git"**
   - หรือหาเมนู **"Deployment"** → **"Git Integration"**

   **เชื่อมต่อ Git Repository:**
   - เลือก Git Provider (GitHub, GitLab, Bitbucket)
   - Authorize FZL ให้เข้าถึง repository
   - เลือก Repository และ Branch (ปกติเป็น `main` หรือ `master`)

   **ตั้งค่า Build Configuration:**
   ```
   Build Command: NUXT_GENERATE=true pnpm generate
   Output Directory: .output/public
   Node Version: 18 หรือ 20
   Install Command: pnpm install
   ```

   **ตั้งค่า Environment Variables:**
   - ในส่วน Environment Variables ของ Git Deploy
   - เพิ่ม variables เหมือนกับที่อธิบายไว้ในส่วน "ตั้งค่า Environment Variables"

3. **ทดสอบ Auto-Deploy**
   ```bash
   # ทำการเปลี่ยนแปลงเล็กน้อย
   echo "# Test" >> README.md
   
   # Commit และ Push
   git add .
   git commit -m "Test auto-deploy"
   git push origin main
   ```

4. **ตรวจสอบ Deploy Status**
   - กลับไปที่ FZL Control Panel
   - ดูที่ **"Deploy Logs"** หรือ **"Build History"**
   - ควรเห็น status ว่า "Building..." → "Deploying..." → "Success"
   - รอสักครู่ (ประมาณ 2-5 นาที) แล้วตรวจสอบเว็บไซต์

#### ข้อดีของ Git Auto-Deploy:
- ✅ **อัตโนมัติ**: ไม่ต้อง upload ไฟล์เอง
- ✅ **Version Control**: มีประวัติการเปลี่ยนแปลง
- ✅ **Rollback**: สามารถกลับไปใช้ version เก่าได้
- ✅ **Team Collaboration**: ทีมสามารถ deploy ได้

#### ข้อควรระวัง:
- ⚠️ **ต้องมี Node.js ใน FZL**: ตรวจสอบว่า FZL รองรับ Node.js
- ⚠️ **Build Time**: อาจใช้เวลา 2-5 นาทีในการ build
- ⚠️ **Environment Variables**: ต้องตั้งค่าใน FZL Control Panel
- ⚠️ **.env File**: อย่า commit `.env` file ไปยัง Git (ใช้ environment variables ใน FZL แทน)

#### ถ้า FZL ไม่รองรับ Git Deploy:
- ใช้วิธี FTP หรือ File Manager แทน
- หรือใช้ CI/CD service เช่น GitHub Actions, GitLab CI

---

## ⚙️ ตั้งค่า Environment Variables

### ใน FZL Control Panel:

1. **หา "Environment Variables" หรือ ".env"**
   - ไปที่ control panel
   - หาเมนู "Environment Variables" หรือ "Environment Settings"

2. **เพิ่ม Variables ต่อไปนี้**:

   ```
   GQL_HOST=https://your-wordpress-site.com/graphql
   WP_MEDIA_HOST=https://your-wordpress-site.com
   WP_BASIC_AUTH=your_basic_auth_token
   WC_CONSUMER_KEY=your_consumer_key
   WC_CONSUMER_SECRET=your_consumer_secret
   BASE_URL=https://your-domain.com
   ```

3. **บันทึกการตั้งค่า**

### สร้างไฟล์ .htaccess (ถ้ายังไม่มี)

สร้างไฟล์ `.htaccess` ใน `public_html` หรือ `www`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Handle Vue Router / Nuxt routing
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Enable compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Browser caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType text/javascript "access plus 1 month"
</IfModule>
```

---

## ✅ ตรวจสอบหลัง Deploy

### 1. ตรวจสอบหน้าแรก

เปิด browser ไปที่:
```
https://your-domain.com
```

ควรเห็นหน้าแรกของเว็บไซต์

### 2. ตรวจสอบ Navigation

- ตรวจสอบว่าลิงก์ต่างๆ ทำงานได้:
  - หน้าแรก
  - หมวดหมู่
  - รายการโปรด
  - หน้าเข้าสู่ระบบ

### 3. ตรวจสอบ Console

เปิด Developer Tools (F12) และตรวจสอบ:
- **Console**: ไม่มี error
- **Network**: ไฟล์ถูกโหลดสำเร็จ
- **Application**: LocalStorage และ Cookies ทำงานได้

### 4. ตรวจสอบ API

ตรวจสอบว่า API calls ทำงานได้:
- ดูใน Network tab
- ตรวจสอบว่า API responses ถูกต้อง

---

## 🔧 Troubleshooting

### ปัญหา: หน้าเว็บแสดงเป็น blank หรือ error

**วิธีแก้**:
1. ตรวจสอบว่าไฟล์ถูก upload ครบถ้วน
2. ตรวจสอบ `.htaccess` ว่าถูกต้อง
3. ตรวจสอบ Console ใน browser สำหรับ error messages
4. ตรวจสอบว่า BASE_URL ถูกตั้งค่าถูกต้อง

### ปัญหา: ภาพไม่แสดง

**วิธีแก้**:
1. ตรวจสอบว่า `_nuxt` folder ถูก upload แล้ว
2. ตรวจสอบ WP_MEDIA_HOST ใน environment variables
3. ตรวจสอบ CORS settings ใน WordPress

### ปัญหา: API ไม่ทำงาน

**วิธีแก้**:
1. ตรวจสอบ environment variables ทั้งหมด
2. ตรวจสอบว่า WordPress API ทำงานได้
3. ตรวจสอบ CORS headers ใน WordPress
4. ตรวจสอบ Network tab ใน browser

### ปัญหา: Routing ไม่ทำงาน (404 error)

**วิธีแก้**:
1. ตรวจสอบ `.htaccess` ว่าถูกต้อง
2. ตรวจสอบว่า mod_rewrite เปิดใช้งานใน Apache
3. ลองใช้ `index.html` แทน root path

### ปัญหา: Generate ไม่สำเร็จ

**วิธีแก้**:
1. ตรวจสอบ Node.js version
2. ลบ `node_modules` และ `.output` แล้วติดตั้งใหม่:
   ```bash
   rm -rf node_modules .output
   pnpm install
   NUXT_GENERATE=true pnpm generate
   ```
3. ตรวจสอบ error messages ใน terminal

---

## 📝 Checklist ก่อน Deploy

- [ ] Node.js version ถูกต้อง (16.14+)
- [ ] Dependencies ติดตั้งแล้ว (`pnpm install`)
- [ ] Environment variables ถูกตั้งค่าแล้ว
- [ ] Generate static site สำเร็จ (`pnxt generate`)
- [ ] ไฟล์ใน `.output/public/` ครบถ้วน
- [ ] Upload ไฟล์ไปยัง hosting แล้ว
- [ ] `.htaccess` ถูกสร้างแล้ว
- [ ] Environment variables ตั้งค่าใน hosting แล้ว
- [ ] ตรวจสอบหน้าเว็บทำงานได้
- [ ] ตรวจสอบ API ทำงานได้
- [ ] ตรวจสอบ Console ไม่มี error

---

## 🎯 Tips และ Best Practices

### 1. ใช้ Git สำหรับ Version Control

```bash
# สร้าง .gitignore
echo ".output" >> .gitignore
echo "node_modules" >> .gitignore
echo ".env" >> .gitignore
```

### 2. สร้าง Backup ก่อน Deploy

```bash
# Backup ไฟล์ปัจจุบันใน hosting
# หรือใช้ Git tag
git tag v1.0.0
git push origin v1.0.0
```

### 3. ใช้ Staging Environment

- Deploy ไปยัง subdomain หรือ staging URL ก่อน
- ทดสอบให้แน่ใจว่าทุกอย่างทำงานได้
- แล้วค่อย deploy ไปยัง production

### 4. Monitor Performance

- ใช้ tools เช่น Google PageSpeed Insights
- ตรวจสอบ loading time
- Optimize images และ assets

### 5. Security

- อย่า commit `.env` file
- ใช้ HTTPS เสมอ
- ตั้งค่า security headers ใน `.htaccess`

---

## 📞 ต้องการความช่วยเหลือ?

ถ้ามีปัญหาหรือคำถาม:
1. ตรวจสอบ error messages ใน browser console
2. ตรวจสอบ server logs ใน hosting control panel
3. ตรวจสอบ Network tab ใน browser
4. อ่าน documentation ของ Nuxt.js: https://nuxt.com

---

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมดแล้ว เว็บไซต์ของคุณควรจะทำงานได้แล้ว!

**Good luck with your deployment! 🚀**

