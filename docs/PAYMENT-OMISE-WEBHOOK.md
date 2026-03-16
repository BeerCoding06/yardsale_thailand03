# สถานะระบบ Payment และการทดสอบ Omise + Webhook

## สรุป Payment Stack ปัจจุบัน

```
Nuxt frontend (www.yardsaleth.com)
    ↓ สร้างออเดอร์ (JWT → WordPress plugin หรือ PHP → WooCommerce)
WooCommerce (cms.yardsaleth.com)
    ↓ ถ้าเปิดชำระด้วย Omise ที่ WooCommerce
Omise
    ↓ charge / confirm payment
Webhook (Omise → WooCommerce URL)
    ↓ ส่ง event ชำระสำเร็จ
WooCommerce อัปเดตออเดอร์: Pending payment → Processing
```

---

## Checkout + Omise PromptPay (Test)

ใน Nuxt มีการเลือกวิธีชำระ **ชำระปลายทาง (COD)** และ **PromptPay (Omise – ทดสอบ)** แล้ว

### Flow PromptPay

1. ลูกค้าเลือก **PromptPay** ใน checkout → กดชำระเงิน
2. Nuxt สร้างออเดอร์ใน WooCommerce (status: pending, payment_method: promptpay)
3. Nuxt เรียก `POST /api/omise-create-charge` (order_id, amount_thb) → สร้าง Source + Charge ที่ Omise
4. ถ้า Omise คืน `authorize_uri` → redirect ไปหน้านั้น (ลูกค้าสแกน/ชำระ)
5. ถ้าไม่มี authorize_uri แต่มี `scannable_code` → ไปหน้า `/payment-promptpay` แสดง QR
6. หลังลูกค้าชำระ Omise ส่ง **Webhook** ไป `POST /api/omise-webhook` → Nuxt เรียก WordPress `yardsale/v1/order-paid` → ออเดอร์เปลี่ยนเป็น **Processing**

### ค่า Environment (Omise Test)

ใน `.env` หรือ runtime:

```env
# Omise Test keys (จาก Omise Dashboard → Keys)
OMISE_PUBLIC_KEY=pkey_test_xxxx
OMISE_SECRET_KEY=skey_test_xxxx
# Optional: สำหรับตรวจ signature webhook
OMISE_WEBHOOK_SECRET=whsec_xxxx
# ค่าลับให้ WordPress รับคำขอ order-paid (ตั้งใน WordPress ด้วยค่าเดียวกัน)
OMISE_ORDER_PAID_SECRET=your_random_secret_string
```

ใน **WordPress** (wp-config.php หรือ env ของเว็บเซิร์ฟเวอร์) ตั้งค่าเดียวกับ Nuxt สำหรับ order-paid:

```php
define('OMISE_ORDER_PAID_SECRET', 'your_random_secret_string');
// หรือ OMISE_WEBHOOK_SECRET
```

### ตั้ง Webhook ใน Omise Dashboard

1. ไป **Omise Dashboard** → **Settings** → **Webhooks** → Add endpoint
2. URL: `https://www.yardsaleth.com/api/omise-webhook` (หรือโดเมนที่ deploy Nuxt จริง)
3. เลือก event เช่น **charge.complete** / **charge.successful**
4. หลังลูกค้าชำระ Omise จะ POST ไป URL นี้ → Nuxt อัปเดตออเดอร์เป็น Processing

---

## วิธีจ่ายเงินใน Test Mode (PromptPay / QR)

⚠️ **ใน Test Mode QR Code จะจ่ายเงินจริงไม่ได้** — Omise จะ simulate การชำระให้

### ขั้นตอนทดสอบ

1. เปิดหน้า payment (หน้าแสดง QR Code หลังเลือกชำระด้วย PromptPay)
2. แสดง QR Code ตามปกติ
3. **รอประมาณ 10–20 วินาที**
4. Omise จะส่ง webhook **charge.complete** (หรือ charge.successful) มาที่ `/api/omise-webhook`
5. ออเดอร์จะเปลี่ยนสถานะเป็น **Processing**

ในหน้า payment-promptpay จะมีกล่องคำอธิบาย Test Mode แจ้งผู้ทดสอบให้รอ 10–20 วินาที แล้วออเดอร์จะอัปเดตเอง

---

## ตรวจเช็ค: สถานะ WooCommerce เปลี่ยนหลังชำระเงิน

Flow ที่ทำให้สถานะเปลี่ยน:

1. **สร้าง Charge** (`server/api/omise-create-charge.post.ts`)  
   - ส่ง `metadata: { order_id: String(order_id) }` ไป Omise ตอนสร้าง charge  
   - ถ้าไม่มี → webhook จะไม่มี order_id อัปเดตไม่ได้

2. **Omise ส่ง Webhook** มาที่ Nuxt `POST /api/omise-webhook`  
   - Event: `charge.complete`  
   - Body: `{ object: 'event', key: 'charge.complete', data: { object: 'charge', status: 'successful', metadata: { order_id: '123' } } }`  
   - Nuxt ตรวจ: `payload.object === 'event'`, `data.object === 'charge'`, `data.status === 'successful'`, มี `data.metadata.order_id`

3. **Nuxt เรียก WordPress**  
   - `POST {wpBaseUrl}/wp-json/yardsale/v1/order-paid`  
   - Body: `{ order_id: number, secret: OMISE_ORDER_PAID_SECRET }`  
   - ต้องตั้ง `wpBaseUrl` (Nuxt) และ WordPress ต้องเปิด endpoint นี้ได้จาก Nuxt

4. **WordPress Plugin** (`yardsale_order_paid`)  
   - ตรวจ `secret` ตรงกับ `OMISE_ORDER_PAID_SECRET` หรือ `OMISE_WEBHOOK_SECRET` ใน wp-config  
   - `wc_get_order(order_id)` → `$order->payment_complete()`  
   - สถานะ WooCommerce จะเปลี่ยนเป็น **Processing** และบันทึกว่าชำระแล้ว (วันที่ชำระ, ลดสต็อก)

### Checklist ให้สถานะเปลี่ยน

| รายการ | ตรวจ |
|--------|------|
| Omise Dashboard → Webhooks | URL = `https://{โดเมน Nuxt}/api/omise-webhook` และเลือก event **charge.complete** |
| Nuxt env | `OMISE_WEBHOOK_SECRET` (ถ้าใส่ Omise จะตรวจ signature), `OMISE_ORDER_PAID_SECRET` |
| WordPress wp-config.php | `define('OMISE_ORDER_PAID_SECRET', 'ค่าเดียวกับ Nuxt');` |
| Nuxt env | `WP_BASE_URL` หรือ `wpBaseUrl` ชี้ไป WordPress จริง (เช่น cms.yardsaleth.com) |
| สร้าง charge | ส่ง `metadata.order_id` แล้ว (ใน omise-create-charge มีแล้ว) |

### ถ้าสถานะไม่เปลี่ยน

- ดู log เซิร์ฟเวอร์ Nuxt: `[omise-webhook] ...` (เรียก order-paid หรือไม่, order-paid failed หรือไม่)  
- ดู Omise Dashboard → Webhooks → Recent Deliveries: ต้องได้ **200**  
- ดู error log WordPress: `[yardsale_order_paid] Invalid or missing secret` หรือ `Order ... payment_complete`

---

## สิ่งที่ Nuxt ทำอยู่ตอนนี้

| ส่วน | สถานะ |
|------|--------|
| หน้า Checkout | มี – ฟอร์มที่อยู่ + เลือกวิธีชำระ (COD / PromptPay) |
| การสร้างออเดอร์ | ทำงาน – ส่ง JWT ไป WordPress plugin `yardsale/v1/create-order` |
| PromptPay (Omise Test) | มี – เลือกได้ใน checkout, สร้าง Source+Charge, redirect/QR, webhook อัปเดตออเดอร์ |

---

## การทดสอบ Omise + Webhook (ฝั่ง WooCommerce)

### 1. เปิดหน้า Checkout ของเว็บ

- ไปที่ Nuxt (เช่น https://www.yardsaleth.com) → ใส่ของในตะกร้า → ไปหน้า Checkout
- กรอกที่อยู่ → กดปุ่มชำระเงิน  
- ตอนนี้: ออเดอร์จะถูกสร้างใน WooCommerce เป็น **COD, Pending** แล้ว Nuxt ไปหน้า payment-successful

ถ้าต้องการให้ **จ่ายด้วยบัตร test** (4242 4242 4242 4242, Expiry 12/30, CVV 123) แล้วออเดอร์เปลี่ยนเป็น Processing:

- ต้องมี **การชำระผ่าน Omise** เกิดขึ้นที่ WooCommerce (เช่น ใช้ WooCommerce checkout ที่มี Omise gateway หรือหน้าชำระที่เรียก Omise หลังสร้างออเดอร์)
- Flow ที่มักใช้: สร้างออเดอร์ใน WooCommerce (Pending payment) → ไปหน้าชำระ Omise (หรือ WooCommerce checkout ที่ต่อ Omise) → ลูกค้ากรอกบัตร → Omise charge → Omise ส่ง webhook ไป WooCommerce → WooCommerce อัปเดตออเดอร์เป็น Processing

### 2. ดูออเดอร์ใน WooCommerce

- **WooCommerce → Orders**
- ออเดอร์ที่สร้างจาก Nuxt จะเป็น **Pending payment** (หรือ Pending ถ้าเป็น COD)
- ถ้า Webhook จาก Omise ทำงานถูกต้อง: หลังชำระสำเร็จออเดอร์จะเปลี่ยนเป็น **Processing** (หรือตามที่ตั้งใน WooCommerce/Omise plugin)

### 3. เช็ค Webhook ทำงานจริง

- ไปที่ **Omise Dashboard** → **Settings** → **Webhooks** → **Recent Deliveries**
- เลือก webhook endpoint ที่ชี้ไป WooCommerce (URL ที่ plugin Omise ลงทะเบียนไว้)
- หลังทดสอบชำระด้วยบัตร test ควรเห็นการส่ง event (เช่น `charge.complete`) และ **Status 200** = WooCommerce รับและตอบสำเร็จ

ถ้าเห็น **ไม่ใช่ 200** (เช่น 4xx/5xx):

- URL webhook ผิด หรือ WooCommerce ไม่ได้เปิด endpoint นั้น
- SSL / firewall บล็อก Omise
- Plugin WooCommerce ที่รับ webhook มี error หรือไม่ลงทะเบียน route

---

## สรุปสถานะระบบตอนนี้

| ชั้น | สถานะ | หมายเหตุ |
|------|--------|----------|
| Nuxt frontend | ทำงาน | สร้างออเดอร์ผ่าน JWT → WordPress plugin, ฟอร์ม checkout เติมจาก login |
| WooCommerce | ทำงาน | รับการสร้างออเดอร์จาก plugin (create-order), ออเดอร์เป็น pending/cod |
| Omise | ต้องตั้งที่ WooCommerce | ไม่มีใน Nuxt – ต้องใช้ Omise plugin / gateway ที่ WooCommerce และเปิดชำระด้วยบัตร |
| Webhook | ต้องตั้งที่ Omise + WooCommerce | Omise Dashboard → Webhooks → URL ชี้ไป WooCommerce; เช็ค Recent Deliveries ว่าได้ Status 200 |
| อัปเดตออเดอร์ (Pending → Processing) | หลัง Webhook ทำงาน | ขึ้นกับ WooCommerce/Omise plugin ว่าตั้งให้เปลี่ยนสถานะเมื่อ event ชำระสำเร็จ |

---

## ถ้าต้องการให้ “กดชำระที่ Nuxt แล้วจ่ายด้วยบัตร (Omise)”

มีสองแนวทางหลัก:

1. **Redirect ไป WooCommerce checkout**  
   หลัง Nuxt สร้างออเดอร์แล้ว redirect ไป URL ชำระของ WooCommerce (ที่มี Omise) พร้อม order key / order id เพื่อให้ลูกค้ากรอกบัตรที่ WooCommerce → Omise → Webhook อัปเดตออเดอร์เหมือนเดิม

2. **ใช้ Omise ใน Nuxt โดยตรง**  
   หลังสร้างออเดอร์จาก Nuxt แล้ว เปิดหน้า/โมดัลชำระ (Omise.js / SDK) ให้กรอกบัตร → ส่ง charge ไป Omise → ตั้ง Webhook URL ให้ชี้ไป WooCommerce (หรือ API ของคุณ) เพื่ออัปเดตออเดอร์จาก Pending payment เป็น Processing เมื่อ charge สำเร็จ

ทั้งสองแบบ Webhook ยังต้องชี้ไปที่ที่อัปเดตออเดอร์ได้ (โดยมากคือ WooCommerce ผ่าน plugin) และการเช็คว่า “Webhook ทำงานจริงไหม” ยังทำที่ **Omise Dashboard → Settings → Webhooks → Recent Deliveries** ดู **Status 200** เหมือนเดิม
