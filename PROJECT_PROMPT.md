# Yardsale Thailand — Project prompt / overview

เอกสารนี้สรุปโปรเจกต์ **yardsale_thailand** (เวอร์ชัน storefront ~ `package.json`) เพื่อใช้เป็นบริบทเดียวกันเมื่อพัฒนา หรือวางใน Cursor / AI เป็น “system prompt” สำหรับโค้ดเบสนี้

---

## ภาพรวม

- **ประเภท**: Headless marketplace / storefront (เริ่มจาก WooCommerce-style UI) + **Backend ของโปรเจกต์คือ Express + PostgreSQL** (ไม่ใช้ ORM ในระดับหลัก — เขียน SQL ตรงกับ `pg`)
- **Frontend**: **Nuxt 4** (Vue 3), SSR เลือกได้ตามหน้า (`ssr: false` เป็นค่าเริ่มต้นของแอป แต่มี routeRules ให้บางหน้า SSR)
- **ผู้ใช้**: ลูกค้าซื้อของ, ผู้ขาย (seller), แอดมิน (admin)
- **ภาษา**: i18n (`@nuxtjs/i18n`) — default **ไทย (`th`)**, fallback **อังกฤษ**, มี nb/nl/de เพิ่มเติม

---

## โครงสร้างโฟลเดอร์หลัก

| พื้นที่ | คำอธิบาย |
|--------|-----------|
| `/app/` | Nuxt: `pages`, `components`, `composables`, `plugins`, `utils`, `assets` |
| `/server/` | Nitro: proxy `/yardsale-api/*` → Express, auth routes บางส่วน, `uploads` |
| `/backend/` | Express API (`yardsale-api`): `routes`, `controllers`, `services`, `models`, `validators`, `db/migrations` |
| `/i18n/locales/` | JSON ข้อความ (เช่น `th-TH.json`, `en-GB.json`) |
| `/public/` | ไฟล์สแตติก, รูป PromptPay เป็นต้น |

---

## การเชื่อม Frontend ↔ Backend

1. **`NUXT_PUBLIC_CMS_API_BASE`**
   - **ว่าง** → โหมดพัฒนา/ทดสอบ: มี **mock API** ใน `app/plugins/mock-api.client.ts` ที่ intercept `$fetch` ไป `/api/*` บน origin เดียวกัน (ไม่ครอบคลุม URL ภายนอก)
   - **`/yardsale-api`** (แนะนำใน dev) → same-origin; Nitro proxy ไป Express ที่ `NUXT_YARDSALE_PROXY_TARGET` (ค่าเริ่ม `http://127.0.0.1:4000`)
   - **URL เต็ม** `http(s)://host/api` → เรียกตรง (ระวัง CORS)

2. **Envelope API**: หลาย endpoint ตอบ `{ success: true, data: ... }` — composable `fetchYardsale` แกะ `data` ให้อัตโนมัติ (`unwrapYardsaleResponse`)

3. **รูปสินค้า**: path `/uploads/...` มักอ้างอิง origin ของ backend — ใช้ `NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN` และ/หรือ `NUXT_IMAGE_DOMAINS` ตาม `env.example`

---

## Backend (Express)

- **Entry**: `backend/server.js`
- **Auth**: JWT (Bearer), Passport (OAuth Google/Facebook/Line ตามที่ตั้งค่า), Joi validate body/query
- **DB**: PostgreSQL ผ่าน `pg` pool; migration SQL ใน `backend/db/migrations/` และ schema รวมใน `backend/db/schema.sql`
- **Response helpers**: `sendSuccess`, `sendError` ใน `backend/utils/response.js`

### โดเมนฟีเจอร์หลัก (ไม่ครบทุก route)

- **สินค้า**: list, รายละเอียด, ค้นหา, tags/categories (ชื่อบางส่วนสืบจาก Woo legacy)
- **ตะกร้า**: `/cart/add`, `/cart/update` — ต้อง login; เก็บใน DB ตาม user
- **ออเดอร์**: สร้าง, ดึงออเดอร์, ยกเลิก, แอดมินแก้สถานะ
- **ชำระเงิน**: mock payment, อัปโหลดสลิป / SlipOK (ตามที่ implement), quota ฯลฯ
- **Buyer wallet**: กระเป๋าเงินผู้ซื้อ, ledger ธุรกรรม, **refund** อัตโนมัติ + **คำขอคืนเงิน** (admin อนุมัติ/ปฏิเสธ)
- **แจ้งเตือน**: FCM token / Firebase Admin ฝั่ง backend
- **Admin**: ผู้ใช้, finance, buyer-wallet summary ฯลฯ

---

## Frontend — พฤติกรรมสำคัญ

### Composables ที่ใช้บ่อย

- **`useStorefrontCatalog()`**: `hasRemoteApi`, `fetchYardsale`, `resolveMediaUrl`, `mapApiProductRow`, path สินค้า
- **`useCart()`**: ตะกร้าใน `useState` + **localStorage** พร้อม **session ~48 ชม. (เลื่อนตามการบันทึก)** และ **clamp จำนวนตามสต็อก** — ดู `app/utils/cart-session-storage.ts`, `cart-line-salable.ts`
- **`useAuth()`**: user + JWT ใน `localStorage`
- **`useCmsApi()`**: สร้าง URL endpoint ไป API

### Checkout / ชำระเงิน

- หน้า `checkout/payment`: โอนเงิน + อัปโหลดสลิป — ข้อความบัญชีจาก `NUXT_PUBLIC_STORE_BANK_TRANSFER_INFO` หรือ i18n (`checkout.payment_slip.bank_account_default`)

### UI

- **Nuxt UI** (`@nuxt/ui`), **Notivue** แจ้งเตือน, **Swiper** แกลเลอรีสินค้า

---

## Conventions สำหรับการแก้โค้ด

1. **อย่า refactor ใหญ่โตถ้างานไม่ได้ขอ** — แก้เฉพาะที่เกี่ยวข้อง
2. **API ใหม่**: เพิ่ม route → controller → service → model (ถ้าต้อง query DB) → Joi schema ใน `validators/schemas.js`
3. **Frontend**: ข้อความใหม่ใส่ **i18n** (`th-TH` + `en-GB` อย่างน้อย)
4. **ตะกร้า**: ระวังการรวมจำนวนจาก API — ยอดจากเซิร์ฟเวอร์มักเป็น **ยอดรวมบรรทัด** แล้ว ไม่ควรบวกซ้ำกับของเก่าใน client
5. **เงิน / wallet**: ใช้ transaction DB / lock ตามแพทเทิร์นที่มีใน `buyerWallet` service อยู่แล้ว

---

## คำสั่งรัน (อ้างอิง)

| คำสั่ง | ความหมาย |
|--------|-----------|
| `pnpm dev` / `npm run dev` | Nuxt dev server |
| `npm run dev --prefix backend` | Express API (watch) |
| `npm run db:schema --prefix backend` | รัน schema / setup DB (ดูสคริปต์ใน backend) |
| `npm run db:wallet --prefix backend` | migration ชุด wallet |

ใช้ **pnpm** ตาม `packageManager` ใน root `package.json` ถ้าเป็นไปได้

---

## Environment

ดู **`env.example`** เป็นหลัก — ตัวแปรสำคัญ:

- `BASE_URL`, `NUXT_PUBLIC_CMS_API_BASE`, `NUXT_PUBLIC_YARDSALE_BACKEND_ORIGIN`
- `NUXT_YARDSALE_PROXY_TARGET` (Nitro → Express)
- Firebase / FCM (`NUXT_PUBLIC_FIREBASE_*`)
- บัญชีโอนเงิน: `NUXT_PUBLIC_STORE_BANK_TRANSFER_INFO`

---

## Docker

มี `docker-compose.yml` และ `docker-compose.dokploy.yml` — ใช้สำหรับ deploy / stack แยกตามชื่อ service (เช่น `backend`)

---

## เวอร์ชันอ้างอิง (จาก package.json ณ เวลาสร้างเอกสาร)

- **Root app**: Nuxt `^4.2.0`, Vue latest
- **Backend**: Express 4, Node ESM (`"type": "module"`)

*(เมื่ออัปเดต dependency ควรแก้แถวนี้ให้ตรงกับ repo)*

---

## วิธีใช้เอกสารนี้กับ AI

วางข้อความสั้นๆ เช่น:

> อ่านและปฏิบัติตาม `PROJECT_PROMPT.md` ใน repo — stack คือ Nuxt 4 + Express + PostgreSQL; API envelope `{ success, data }`; ตะกร้ามี session localStorage และ buyer wallet มี ledger/refund

หรือแนบไฟล์นี้เป็น knowledge / rule ใน Cursor

---

*สร้างเป็นไฟล์ช่วยจำ — หากโครงสร้างเปลี่ยนมาก ควรอัปเดตส่วน “โครงสร้าง” และ “คำสั่งรัน” ให้ตรงจริง*
