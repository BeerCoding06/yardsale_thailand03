# Laravel FCM Example Files

โฟลเดอร์นี้เป็นชุดไฟล์ตัวอย่างสำหรับนำไปใส่ใน Laravel project จริง

ประกอบด้วย:
- Migration: `database/migrations/2026_04_16_000000_create_fcm_tokens_table.php`
- API routes: `routes/api.php`
- Controllers: `app/Http/Controllers/Api/*`
- Job + Service (Firebase HTTP v1)
- Observer ตัวอย่างส่งแจ้งเตือนตอนสร้าง order / อัปเดต inspection status

ดูขั้นตอน setup แบบครบถ้วนที่:
- `docs/FIREBASE_PUSH_NOTIFICATION_SETUP.md`
