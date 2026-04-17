# Firebase Cloud Messaging (FCM) — คู่มือตั้งค่า

> **ความปลอดภัย:** ถ้าเคยวาง private key หรือ JSON service account ในแชท / issue สาธารณะ — **ให้หมุน (rotate) คีย์ทันที** ใน Google Cloud Console → IAM → Service Accounts → Keys แล้วลบคีย์เก่า

## สิ่งที่โปรเจกต์นี้มีอยู่แล้ว

| ส่วน | รายละเอียด |
|------|-------------|
| **Frontend (Nuxt)** | `app/plugins/fcm-push.client.ts`, `app/composables/useFcmPush.ts` — ขอสิทธิ์, ลงทะเบียน SW, `getToken` (VAPID), ส่ง token ไป backend, `onMessage` (foreground) |
| **Service worker** | `public/firebase-messaging-sw.js` — background message, แสดง title/body/icon/image, `notificationclick` เปิด `click_action` |
| **Backend** | Firebase **Admin SDK** (`firebase-admin`) ส่ง FCM HTTP v1 ผ่าน `sendEachForMulticast`, ลบ token เสีย, retry ชั่วคราว |
| **API** | `POST /api/save-token` และ **alias** `POST /api/save-fcm-token` (JWT), `POST /api/send-notification` (admin), `POST /api/broadcast` (admin) |
| **DB** | ตาราง `fcm_tokens` (`user_id`, `token` unique, `device`, `created_at`, `updated_at`) |
| **ออเดอร์** | `fcmOrderNotify.service.js` — หลังชำระเงินสำเร็จ แจ้ง **ผู้ขาย** พร้อมลิงก์ไป `/my-orders` |

## ขั้นตอนตั้งค่า

### 1) Firebase Console (เว็บ)

1. สร้างโปรเจกต์ Firebase (หรือใช้ GCP เดิม)
2. Project settings → **Cloud Messaging** → สร้าง **Web Push certificates (VAPID key)**
3. เพิ่มแอปเว็บ → คัดลอก `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`, `storageBucket`

### 2) Service account (เซิร์ฟเวอร์)

1. Google Cloud Console → IAM → Service Accounts → สร้าง key แบบ JSON  
2. ให้สิทธิ์ส่งข้อความผ่าน FCM (โดยทั่วไป role **Firebase Admin SDK Administrator Service Agent** หรือตามที่ Google แนะนำสำหรับ FCM v1)

### 3) ตัวแปรสภาพแวดล้อม — **Nuxt (public)**

ตั้งใน `.env` / Dokploy สำหรับ build / runtime:

```bash
NUXT_PUBLIC_FIREBASE_API_KEY=...
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NUXT_PUBLIC_FIREBASE_PROJECT_ID=...
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NUXT_PUBLIC_FIREBASE_APP_ID=...
NUXT_PUBLIC_FIREBASE_VAPID_KEY=...
NUXT_PUBLIC_CMS_API_BASE=/yardsale-api
```

### 4) ตัวแปรสภาพแวดล้อม — **Express (ลับ)**

เลือก **อย่างใดอย่างหนึ่ง**:

**ไฟล์ JSON**

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS=/run/secrets/firebase.json
```

**JSON บรรทัดเดียว**

```bash
FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
```

**แยกตัวแปร (Docker)**

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=...@....iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

ลิงก์เมื่อคลิกแจ้งเตือน (ถ้าไม่ตั้ง จะใช้ origin แรกจาก `CORS_ORIGINS`):

```bash
PUBLIC_WEB_URL=https://www.example.com
```

### 5) ติดตั้ง dependency แบ็กเอนด์

จากโฟลเดอร์ `backend/`:

```bash
npm install
```

จากนั้น (แนะนำ) commit `package-lock.json` และเปลี่ยน `backend/Dockerfile` กลับไปใช้ `npm ci` เพื่อ build ซ้ำได้เสถียร

### 6) ฐานข้อมูล

รัน schema / migration ที่มี `fcm_tokens` (เช่น `npm run db:schema` ใน `backend`)

## ตัวอย่างคำขอ (curl)

แทนที่ `API`, `JWT`, `TOKEN` ด้วยค่าจริง

### บันทึก FCM token (ผู้ใช้ล็อกอิน)

```bash
curl -sS -X POST "$API/api/save-fcm-token" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"device\":\"web\"}"
```

### ส่งให้ user_ids / tokens (แอดมิน)

```bash
curl -sS -X POST "$API/api/send-notification" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"ทดสอบ",
    "body":"ข้อความ",
    "user_ids":["00000000-0000-4000-8000-000000000000"],
    "image":"https://www.gstatic.com/mobilesdk/190503_mobilesdk/firebase_96dp.png",
    "click_action":"https://example.com/orders",
    "data":{"foo":"bar"}
  }'
```

### Broadcast ทุก token (แอดมิน, มี rate limit)

```bash
curl -sS -X POST "$API/api/broadcast" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"ประกาศ",
    "body":"ข้อความถึงทุกคน",
    "click_action":"https://example.com/",
    "data":{"type":"announcement"}
  }'
```

## คิว (BullMQ) และหลาย instance

ตอนนี้ **broadcast** ทำงานแบบ sequential ในโปรเซสเดียว (delay ระหว่าง chunk) เหมาะกับเซิร์ฟเวอร์ตัวเดียว

ถ้าต้องการ **BullMQ + Redis** สำหรับหลาย worker / retry policy ละเอียด:

- เพิ่มบริการ Redis ใน Compose
- ติดตั้ง `bullmq` + `ioredis`
- แยก worker process เรียกฟังก์ชันเดียวกับ `fcmBroadcast.service.js`

## อ้างอิงไฟล์หลัก

- `backend/services/firebaseMessaging.service.js` — ส่งข้อความ, ลบ token ไม่ถูกต้อง
- `backend/services/fcmBroadcast.service.js` — วนส่งทุก token
- `backend/middlewares/fcmRateLimit.js` — จำกัดความถี่
- `backend/controllers/fcm.controller.js`
- `public/firebase-messaging-sw.js`
