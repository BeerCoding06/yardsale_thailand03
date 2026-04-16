# Firebase Push Notification (Laravel + Vue/Nuxt)

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
NUXT_PUBLIC_LARAVEL_API_BASE=http://127.0.0.1:8000

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
  - เรียก `initFcmPush()` อัตโนมัติเมื่อหน้าเว็บพร้อมใช้งาน
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

## 3) Example: ส่งแจ้งเตือนเมื่อมี Order ใหม่

ไฟล์ตัวอย่าง:
- `app/Observers/OrderObserver.php`
- `app/Providers/AppServiceProvider.php`

พฤติกรรม:
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

## 5) Firebase Console Checklist

1. เปิด Cloud Messaging API ใน Google Cloud (โปรเจกต์เดียวกับ Firebase)
2. สร้าง Service Account JSON สำหรับ backend Laravel
3. ใส่ Web App config + VAPID key ใน env ของ Nuxt
4. ทดสอบบน HTTPS หรือ localhost เท่านั้น (browser policy ของ notification)
