# Deploy on Dokploy (Frontend + Backend + PostgreSQL)

This guide is specific to this repository and uses:
- `frontend`: Nuxt (`Dockerfile.prod`)
- `backend`: Express API (`backend/Dockerfile`)
- `postgres`: PostgreSQL 16

## 1) Files used

- `docker-compose.dokploy.yml`
- `Dockerfile.prod`
- `backend/Dockerfile`

## 2) Create app in Dokploy

1. Create a new **Docker Compose** application.
2. Connect your Git repository.
3. Set compose path to: `docker-compose.dokploy.yml`
4. Select branch (for example `main`).

## 3) Environment variables on Dokploy

ตั้งใน **Dokploy → แอป Compose นี้ → Environment** (ทั้ง stack ใช้ชุดเดียวก็ได้ เพราะ `docker-compose.dokploy.yml` ส่งต่อให้ `postgres` / `backend` / `frontend`)

### บล็อกคัดลอก — แก้ `your-domain` แล้ววางทีเดียว

```env
# --- บังคับ (secret) ---
POSTGRES_PASSWORD=change-this-strong-password
JWT_SECRET=change-this-long-random-secret-at-least-32-chars

# --- ฐานข้อมูล / JWT ---
POSTGRES_DB=yardsale
POSTGRES_USER=yardsale
JWT_EXPIRES_IN=7d

# --- URL สาธารณะ (ห้ามใช้ http://backend:4000 ใน NUXT_PUBLIC_* ) ---
BASE_URL=https://www.your-domain.com
NUXT_PUBLIC_CMS_API_BASE=https://api.your-domain.com/api
NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN=https://api.your-domain.com
NUXT_IMAGE_DOMAINS=api.your-domain.com,www.your-domain.com,your-domain.com

# --- CORS (ใส่ origin หน้าเว็บที่ลูกค้าเปิดจริง) ---
CORS_ORIGINS=https://www.your-domain.com,https://your-domain.com

# --- FCM: บันทึก token + ยิง push (ฝั่งเบราว์เซอร์ → API เดียวกับ Express) ---
# ค่า Firebase ทั้งหมดมาจาก Firebase Console → Project settings → Your apps → Web
NUXT_PUBLIC_LARAVEL_API_BASE=https://api.your-domain.com
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=
NUXT_PUBLIC_FIREBASE_VAPID_KEY=

# --- FCM: ฝั่งเซิร์ฟเวอร์ (ยิง HTTP v1) ใช้อย่างใดอย่างหนึ่ง ---
FIREBASE_PROJECT_ID=
# แบบ A: วาง JSON ทั้งก้อนเป็น secret (แนะนำบน Dokploy — minify เป็นบรรทัดเดียว)
FIREBASE_CREDENTIALS_JSON=
# แบบ B: path ไฟล์ใน container (ต้อง mount ไฟล์เข้าไปที่ path นั้น)
# FIREBASE_CREDENTIALS=/run/secrets/firebase.json
```

หมายเหตุ:

- `DATABASE_URL` ไม่ต้องใส่ใน Dokploy สำหรับ compose นี้ — compose สร้างให้ backend จาก `POSTGRES_*` อัตโนมัติ
- `NUXT_PUBLIC_LARAVEL_API_BASE` ชื่อยังว่า Laravel แต่ **ชี้ไปที่โดเมน Express** (`https://api...`) **ไม่**ต่อ `/api` ท้าย URL
- หลัง deploy ครั้งแรกที่มีตาราง `fcm_tokens`: รัน `npm run db:schema` ใน **backend** container

รายละเอียดเพิ่ม: `docs/FIREBASE_PUSH_NOTIFICATION_SETUP.md`

### Safari / iPhone (Web Push)

- โปรเจกต์มี **`/site.webmanifest`** + meta **เพิ่มไปที่หน้าจอโฮม (PWA)** แล้ว — บน **iOS 16.4+** ให้ผู้ใช้: Safari → แชร์ → **Add to Home Screen** → เปิดจากไอคอน แล้วค่อยอนุญาต notification
- **แตะหน้าจอครั้งหนึ่ง:** Safari/WebKit มักไม่ยอมให้ขอสิทธิ์แจ้งเตือนตอนโหลดหน้า — แอปจะรอ **คลิก/แตะครั้งแรก** แล้วค่อยเปิด dialog อนุญาต (ดู `useFcmPush.ts`)
- **ไม่มี env พิเศษ** สำหรับ Safari นอกจาก HTTPS + ชุด Firebase ด้านบนให้ครบ

## 4) Domain routing in Dokploy

Recommended:
- Frontend service domain: `www.your-domain.com`
- Backend service domain: `api.your-domain.com`

Enable SSL (Let's Encrypt) for both.

## 5) First deploy order

1. Deploy stack.
2. Wait until `postgres`, `backend`, `frontend` are healthy.
3. Run database schema once in backend container:

```bash
npm run db:schema
```

4. Optional seed admin/demo data:

```bash
npm run db:seed
```

## 6) Post-deploy checks

Run from your machine:

```bash
curl -i https://api.your-domain.com/api/products
curl -i https://www.your-domain.com
```

Expected:
- API returns `200` with JSON.
- Frontend returns `200`.

Then test in browser:
- login
- my-orders
- my-products
- seller-orders
- add-to-cart / checkout

## 7) Troubleshooting

### Backend build: `npm ci` — package.json and package-lock.json not in sync

ข้อความแบบ `Missing: google-auth-library@... from lock file` แปลว่า **`backend/package-lock.json` ใน branch ที่ Dokploy clone ยังไม่ตรงกับ `backend/package.json`** (มักเกิดหลังเพิ่ม dependency แต่ยังไม่ได้อัปเดต lock แล้ว push)

บนเครื่อง dev (ใช้ Node **18+** หรือ **20 LTS**):

```bash
cd backend
npm install
git add package.json package-lock.json
git commit -m "chore(backend): sync package-lock with package.json"
git push
```

จากนั้นใน Dokploy ให้ **rebuild backend แบบไม่ใช้ cache** (หรือ trigger deploy ใหม่หลัง push) — ถ้ายังชี้ branch/fork เก่า ให้ตรวจว่าแอปชี้ repo + branch เดียวกับที่ push

### `403` on `/seller-orders`
- Ensure token is valid and role is one of: `user`, `seller`, `admin`.
- Re-login to refresh JWT.

### Frontend cannot call backend (`Failed to fetch`)
- Check `NUXT_PUBLIC_CMS_API_BASE` points to public API URL.
- Check backend domain SSL and CORS (`CORS_ORIGINS`).

### Images not loading
- Ensure `NUXT_IMAGE_DOMAINS` includes backend image host.
- Ensure `NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN` is correct.

### DB connection errors
- Confirm `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`.
- Confirm `postgres` service is healthy before backend start.

## 8) Rollback

If new deploy fails:
1. Roll back to previous successful deployment in Dokploy.
2. Keep database volume unchanged.
3. Re-check changed env vars before redeploy.
