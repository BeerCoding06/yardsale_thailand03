# Security

## โปรเจกต์นี้ (Nuxt เท่านั้น)

- ไม่มี WordPress plugin หรือ PHP ใน `server/api/php/` แล้ว
- เก็บความลับ (PayPal, Omise) ใน environment ของเซิร์ฟเวอร์ — **อย่า** commit ลง git

## แนวทางทั่วไป

- ตรวจ dependencies เป็นระยะ (`pnpm audit`)
- ใช้ HTTPS ใน production
- จำกัด CORS / rate limit ถ้าเปิด API สาธารณะ
