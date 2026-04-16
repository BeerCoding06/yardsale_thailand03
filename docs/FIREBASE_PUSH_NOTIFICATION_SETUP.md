# Firebase Push Notification (Laravel + Vue/Nuxt)

**FCM ยิงจาก:** `Laravel` | `Express`

เอกสารนี้อธิบายการทำ Push Notification สำหรับ:
- มีการสั่งซื้อสินค้าของร้าน
- สถานะการตรวจสอบสินค้า (`inspection_status`) เปลี่ยน

## 1) Frontend (Vue/Nuxt) Setup

### ติดตั้ง dependency

```bash
npm install firebase@9
```

> ใช้ Firebase JS SDK v9 เพื่อความเข้ากันได้กับ Node 14 ได้ดีขึ้น

### ตั้งค่า env ฝั่ง Nuxt

เติมค่าในไฟล์ `.env` จากตัวอย่างใน `env.example`:

```env
# ถ้าใช้ Express เดียวกับ Nuxt (เช่น NUXT_PUBLIC_CMS_API_BASE=/yardsale-api) ไม่ต้องใส่บรรทัดนี้ก็ได้
# NUXT_PUBLIC_LARAVEL_API_BASE=http://127.0.0.1:4000

NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=
NUXT_PUBLIC_FIREBASE_VAPID_KEY=
```

### ไฟล์ที่เพิ่มแล้วในโปรเจกต์นี้

- `app/composables/useFcmPush.ts`
  - ขอ permission
  - register service worker
  - ดึง FCM token
  - ส่ง token ไป backend (`POST /api/save-token`)
  - listen ข้อความตอนแอปเปิดอยู่ (foreground)
- `app/plugins/fcm-push.client.ts`
  - `watch` (immediate) บน `user.id` + `user.token` — ขอ FCM หลัง state ผู้ใช้พร้อม และ **sync token หลังล็อกอิน** (แก้กรณี init ครั้งแรกก่อนมี JWT)
- `public/firebase-messaging-sw.js`
  - รับข้อความ background และแสดง browser notification

## 2) Backend (Laravel) Setup

> ตัวอย่างไฟล์ Laravel ถูกวางไว้ที่ `backend/laravel-fcm-example/` ให้ copy เข้า Laravel project จริงของคุณ

### ติดตั้ง package ที่ต้องใช้

```bash
composer require google/auth
php artisan queue:table
php artisan migrate
```

### ตั้งค่า env ฝั่ง Laravel

อ้างอิงไฟล์ตัวอย่าง `backend/laravel-fcm-example/.env.example`:

```env
QUEUE_CONNECTION=database
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CREDENTIALS=/absolute/path/to/firebase-service-account.json
```

### migrate ตาราง token

ใช้ migration จากไฟล์:
- `database/migrations/2026_04_16_000000_create_fcm_tokens_table.php`

โครงสร้างตาราง:
- `user_id`
- `token` (unique)
- `device`

### API endpoints

ไฟล์ route:
- `routes/api.php`

Endpoints:
- `POST /api/save-token`
- `POST /api/send-notification`

Controller:
- `app/Http/Controllers/Api/FcmTokenController.php`
- `app/Http/Controllers/Api/NotificationController.php`

### Job + Queue

ไฟล์ job:
- `app/Jobs/SendPushNotificationJob.php`

ไฟล์ service (Firebase HTTP v1):
- `app/Services/FirebaseCloudMessagingService.php`

รัน worker:

```bash
php artisan queue:work --queue=notifications,default
```

### Deploy: รัน queue worker จริง (Laravel เท่านั้น)

- **systemd** (ตัวอย่าง unit สั้น ๆ): `ExecStart=/usr/bin/php /var/www/app/artisan queue:work --sleep=3 --tries=3 --queue=notifications,default`
- **Supervisor**: สร้าง `[program:laravel-worker]` ชี้ `command=php /path/to/artisan queue:work ...` แล้ว `supervisorctl reread && supervisorctl update`
- **Docker**: รัน service แยกหรือ `docker compose run --rm app php artisan queue:work --queue=notifications,default` (ชื่อ service/path ให้ตรงกับ image ของคุณ)

ถ้าเลือก **Express** ในรีโปนี้ (`backend/`): ใช้คำสั่งด้านล่างแทน Laravel — ไม่ต้องรัน `php artisan queue:work`

## 2b) Backend (Express — `backend/` ในรีโปนี้)

### env

ดู `backend/.env.example` — ตั้งอย่างน้อย:

```env
FIREBASE_CREDENTIALS=/absolute/path/to/service-account.json
FIREBASE_PROJECT_ID=your-gcp-project-id
```

(`FIREBASE_PROJECT_ID` ไม่บังคับถ้า JSON มี `project_id`)

### ติดตั้ง dependency + schema

แนะนำ **Node.js 14+** (dependency `google-auth-library` v9)

```bash
cd backend && npm install && npm run db:schema
```

ตาราง: `backend/db/migrations/20260417_fcm_tokens.sql` (รวมใน `db/schema.sql` แล้ว)

### API

- `POST /api/save-token` — ต้องมี JWT ของผู้ใช้; body `{ "token": "...", "device": "web" }`
- `POST /api/send-notification` — เฉพาะ **admin** + JWT; body `{ "title", "body", "data?", "user_ids?", "tokens?" }`
- หลังสร้างออเดอร์: แจ้งผู้ขายที่มีสินค้าในออเดอร์อัตโนมัติ — `notifySellersNewOrder`
- หลังชำระเงินสำเร็จ (`/api/payment/mock` → `paid`): แจ้งผู้ซื้อ — `notifyBuyerOrderPaid` (ต้องมี FCM token ของผู้ซื้อใน `fcm_tokens`)

### Nuxt ชี้มาที่ Express

```env
NUXT_PUBLIC_LARAVEL_API_BASE=http://127.0.0.1:4000
```

## 3) Example: ส่งแจ้งเตือนเมื่อมี Order ใหม่

**Express (`backend/`):** หลังสร้างออเดอร์แล้วแจ้งผู้ขายอัตโนมัติ — `backend/services/fcmOrderNotify.service.js` (เรียกจาก `order.service.js`)

**Laravel (ตัวอย่าง):** ไฟล์:
- `app/Observers/OrderObserver.php`
- `app/Providers/AppServiceProvider.php`

พฤติกรรม (Laravel เท่านั้น):
- เมื่อสร้าง order ใหม่ (`created`) → แจ้ง seller ว่ามีออเดอร์ใหม่
- เมื่อ `inspection_status` เปลี่ยน (`updated`) → แจ้ง buyer ว่าสถานะตรวจสอบสินค้าเปลี่ยน

## 4) ตัวอย่างเรียก API

### Save Token

```bash
curl -X POST http://127.0.0.1:8000/api/save-token \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 10,
    "token": "fcm-device-token",
    "device": "web"
  }'
```

### Send Notification

```bash
curl -X POST http://127.0.0.1:8000/api/send-notification \
  -H "Authorization: Bearer <SANCTUM_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Order",
    "body": "Order #1209 has been created",
    "user_ids": [25],
    "data": {
      "type": "new_order",
      "order_id": "1209"
    }
  }'
```

## 4b) Safari / iPhone

- โปรเจกต์มี `public/site.webmanifest` และ meta ใน `app/app.vue` เพื่อให้เพิ่ม **หน้าจอโฮม (PWA)** ได้
- **iOS 16.4+**: Web Push ใช้งานได้ดีขึ้นเมื่อผู้ใช้ **Add to Home Screen** แล้วเปิดจากไอคอนแอป — แท็บ Safari ธรรมดามักจำกัดกว่า
- **การขอสิทธิ์แจ้งเตือน (Safari / WebKit):** เบราว์เซอร์มักบังคับให้ `Notification.requestPermission()` เกิดหลัง **การแตะหรือคลิกของผู้ใช้** ไม่ใช่ตอนโหลดหน้าอัตโนมัติ — ใน `useFcmPush` จะรอ **pointerdown / click ครั้งแรก** บนหน้าแล้วค่อยขอสิทธิ์และลงทะเบียน FCM (ดู console `[fcm] Safari: แตะ...` ในโหมด dev)
- คอมโพเนนต์อื่นสามารถอ่าน `useFcmPush().awaitingSafariGesture` (readonly) เพื่อแสดงข้อความเช่น “แตะที่หน้าจอเพื่อเปิดการแจ้งเตือน” ได้
- ไม่มี env เพิ่มเฉพาะ Safari — ใช้ชุด Firebase + HTTPS เหมือนแพลตฟอร์มอื่น

## 5) Firebase Console Checklist

1. เปิด Cloud Messaging API ใน Google Cloud (โปรเจกต์เดียวกับ Firebase)
2. สร้าง Service Account JSON สำหรับ backend Laravel
3. ใส่ Web App config + VAPID key ใน env ของ Nuxt
4. ทดสอบบน HTTPS หรือ localhost เท่านั้น (browser policy ของ notification)
