# Yardsale Thailand

Nuxt 3 storefront — **ไม่มี WordPress/WooCommerce** แล้ว สินค้าและหมวดหมู่เป็นข้อมูลจำลองใน `server/utils/mock-catalog.ts`

## Tech Stack

- Nuxt 3, Vue 3, TypeScript
- Nitro API routes (`/api/*`) อ่านข้อมูลจำลอง (ไม่เรียก CMS ภายนอก)

## Setup

```bash
pnpm install
cp env.example .env
pnpm dev
```

แก้รายการสินค้า/รูป/ราคาได้ที่ **`server/utils/mock-catalog.ts`**

## ฟีเจอร์ที่ปิด (ไม่มี backend)

- สร้าง/แก้ไขสินค้า, อัปโหลดรูป, โปรไฟล์จริงบนเซิร์ฟเวอร์ → API คืน `501`
- ล็อกอิน/สมัคร → จำลองในเบราว์เซอร์เท่านั้น (ไม่บันทึกผู้ใช้)
- ออเดอร์ → สร้างได้แบบจำลอง; รายการออเดอร์ใน `/my-orders` ว่าง
- PayPal capture สำเร็จแล้วไม่อัปเดต WooCommerce (ไม่มี WC ในโปรเจกต์)

## Environment

ดู `env.example` — หลัก ๆ แค่ `BASE_URL` และค่า PayPal/Omise ถ้าใช้

## แก้ `EACCES` / ลบ `.nuxt-local` ไม่ได้

ถ้าเคยรัน Docker ด้วย root ไฟล์ใน `.nuxt*` อาจเป็นเจ้าของ root — คืนสิทธิ์แล้วลบโฟลเดอร์เก่า:

```bash
sudo chown -R "$(whoami):staff" .nuxt .nuxt-local .yardsale-nuxt node_modules/.cache .vite-cache 2>/dev/null
rm -rf .nuxt-local
pnpm exec nuxt prepare
pnpm dev
```

Build ของ Nuxt อยู่ที่ **`.yardsale-nuxt`** (ไม่ใช่ `.nuxt`) — `pnpm dev` จะรัน `nuxt prepare` ก่อนอัตโนมัติ (`predev`) เพื่อให้มี `#build/route-rules.mjs` ครบ
