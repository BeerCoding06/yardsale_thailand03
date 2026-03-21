# PayPal Smart Buttons + WooCommerce (Nuxt 3)

## Architecture

| Layer | Responsibility |
|-------|------------------|
| Browser | Loads PayPal JS SDK with **public** Client ID only. Renders Smart Buttons. |
| `POST /api/paypal-create-order` | OAuth + **minimal** `POST /v2/checkout/orders`: `intent` + `purchase_units[].amount` only + `application_context.shipping_preference: NO_SHIPPING` (no `custom_id` / `reference_id`). |
| `POST /api/paypal-capture-order` | Capture PayPal แล้วอัปเดต WC: **ลำดับแรก** `PUT wc/v3/orders/{id}` (ถ้ามี `WP_CONSUMER_KEY` / `WP_CONSUMER_SECRET`) → ถ้าล้มเหลวและมี `ORDER_PAID_SECRET` เรียก `yardsale/v1/order-paid` |

Secrets never leave the server.

## Environment variables

```env
# Public (exposed to browser for SDK – use sandbox ID in dev)
NUXT_PUBLIC_PAYPAL_CLIENT_ID=AeA1QIZXiflr1_-...

# Server-only
PAYPAL_CLIENT_SECRET=EL1tUJ...

# sandbox | live
PAYPAL_ENVIRONMENT=sandbox

# Log JSON ไป stdout (Docker / Dokploy) — เหตุการณ์ create/capture สำเร็จ
# PAYPAL_LOG=1

# (ทางเลือก Sandbox) ส่ง PayPal เป็น USD แทน THB — ต้องตั้งคู่กับ public ด้านล่าง
# PAYPAL_ORDER_CURRENCY=USD
# PAYPAL_SANDBOX_THB_TO_USD=0.029
# NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY=USD

# แนะนำ — อัปเดตออเดอร์หลัง PayPal ผ่าน WooCommerce REST (Read/Write keys)
WP_CONSUMER_KEY=ck_...
WP_CONSUMER_SECRET=cs_...

# สำรอง — ถ้า REST ล้มเหลว หรือไม่ใช้ keys: plugin order-paid (ค่าเดียวกับ WordPress)
ORDER_PAID_SECRET=your_random_secret_string
# ถ้า runtime ไม่โหลดจาก build: NUXT_ORDER_PAID_SECRET=ค่าเดียวกัน
```

รายละเอียด REST + `curl` + checklist: **`docs/PAYPAL-WOOCOMMERCE-REST.md`**

WordPress `wp-config.php`:

```php
define('ORDER_PAID_SECRET', 'your_random_secret_string');
```

(ชื่อเก่า `OMISE_ORDER_PAID_SECRET` ยังรองรับใน plugin ถ้ายังไม่อยากย้าย)

## Files

- `server/utils/paypal.ts` – access token, create order, capture
- `server/api/paypal-create-order.post.ts`
- `server/api/paypal-capture-order.post.ts`
- `server/utils/woocommerce-order.ts` — `PUT wc/v3/orders/{id}` + logging
- `app/components/payment/PayPalSmartButton.vue`

## Usage in a page (after WooCommerce order exists)

```vue
<script setup lang="ts">
const router = useRouter();
const orderId = 1234;
const amount = '299.00';

function onPayPalSuccess() {
  router.push(`/payment-successful?order_id=${orderId}`);
}
</script>

<template>
  <ClientOnly>
    <PaymentPayPalSmartButton
      :woocommerce-order-id="orderId"
      :amount="amount"
      currency="THB"
      @success="onPayPalSuccess"
      @cancel="() => {}"
      @error="(e) => console.error(e)"
    />
  </ClientOnly>
</template>
```

Nuxt auto-imports `PaymentPayPalSmartButton` from `components/payment/PayPalSmartButton.vue`.

**SDK URL (frontend):** โหลดแค่ `https://www.paypal.com/sdk/js?client-id=…&currency=…` — สกุลจาก `NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY` (default **USD** ใน `nuxt.config`) หรือ prop `currency` บนปุ่ม ไม่ใส่ `intent` / `disable-funding` ใน URL

## WooCommerce order update (already implemented)

`paypal-capture-order` calls:

`POST {WP_BASE_URL}/wp-json/yardsale/v1/order-paid`

Body:

```json
{ "order_id": 1234, "secret": "<same as ORDER_PAID_SECRET>" }
```

Plugin handler (`wordpress-plugin-yardsale-orders.php` → `yardsale_order_paid`) runs `$order->payment_complete()` so status becomes **processing** and payment is recorded.

### Manual / cURL example

```bash
curl -X POST "https://cms.example.com/wp-json/yardsale/v1/order-paid" \
  -H "Content-Type: application/json" \
  -d '{"order_id":1234,"secret":"your_random_secret_string"}'
```

## Cancel & errors

- **onCancel** – user closed PayPal popup without paying; handle in `@cancel`.
- **onError** – SDK or network errors; handle in `@error`.
- Capture failures return HTTP 4xx/5xx from `/api/paypal-capture-order`; component emits `error` with the thrown value.

## Production hardening (recommended)

1. **Verify amount server-side** – Before `paypal-create-order`, load the WooCommerce order (REST or internal API) and compare `total` to the requested `amount`.
2. **After capture (สำคัญกับ minimal order)** – อ่านยอดจาก PayPal capture response แล้วเทียบกับยอดออเดอร์ WC ก่อนเรียก `order-paid` — เพราะไม่มี `custom_id` ใน PayPal body การอ้างอิง WC มาจาก body ของ `/api/paypal-capture-order`.
3. **Auth** – Require logged-in user JWT on create/capture if only the buyer should pay their order.
4. **Idempotency** – PayPal supports `PayPal-Request-Id` on create (already sent). Handle duplicate capture responses if user retries.
5. **Webhooks** – Optional: subscribe to PayPal webhooks for `PAYMENT.CAPTURE.COMPLETED` as a backup to mark orders paid.

## PayPal Developer

- [Orders v2](https://developer.paypal.com/docs/api/orders/v2/)
- [Smart Payment Buttons](https://developer.paypal.com/docs/checkout/)

Sandbox testing: create sandbox Business + Personal accounts in PayPal Developer Dashboard; use Business app Client ID / Secret.

---

## ทดสอบ Sandbox (developer.paypal.com)

### 1) สร้าง App แบบ Sandbox

1. ไป [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) → **Apps & Credentials**
2. เลือกแท็บ **Sandbox** (ไม่ใช่ Live)
3. สร้างหรือเลือก **Default Application** → คัดลอก **Client ID** และ **Secret**

### 2) ตั้งค่า `.env` ของ Nuxt

```env
NUXT_PUBLIC_PAYPAL_CLIENT_ID=<Client ID จาก Sandbox>
PAYPAL_CLIENT_SECRET=<Secret จาก Sandbox>
PAYPAL_ENVIRONMENT=sandbox
ORDER_PAID_SECRET=<ตรงกับ WordPress wp-config ORDER_PAID_SECRET>
```

รีสตาร์ท dev server หลังแก้ `.env`

**สำคัญ:** Client ID / Secret ต้องเป็นคู่จาก **Sandbox** เท่านั้น ถ้าเอา Live มาใส่จะ error ตอน token หรือ create order

### 2.1) ทำให้สถานะ WooCommerce เปลี่ยนใน Sandbox (สำคัญที่สุด)

การจ่ายผ่าน PayPal Sandbox สำเร็จ **ไม่ได้** ไปแตะ WooCommerce โดยตรง — หลัง capture แล้ว **Nuxt** จะเรียก REST `yardsale/v1/order-paid` ถึง WordPress ถึงจะได้สถานะ **Processing / ชำระแล้ว**

ทำครบตามนี้:

| ลำดับ | ที่ไหน | ทำอะไร |
|--------|--------|--------|
| 1 | **Nuxt** (Dokploy / `.env`) | ตั้ง `ORDER_PAID_SECRET` เป็นสตริงลับยาวพอ (เช่น 32+ ตัวอักษรสุ่ม) |
| 2 | **WordPress** `wp-config.php` | `define('ORDER_PAID_SECRET', 'ค่าเดียวกับข้อ 1');` — บันทึกแล้วรีเฟรช PHP (restart PHP-FPM / container ถ้ามี) |
| 3 | **Nuxt** | `WP_BASE_URL` ชี้ไปโดเมน WooCommerce จริง (เช่น `https://cms.yardsaleth.com`) และเซิร์ฟเวอร์ Nuxt **เข้า WP ได้** |
| 4 | **Nuxt** | `PAYPAL_ENVIRONMENT=sandbox` + Client ID / Secret จากแท็บ **Sandbox** ใน developer.paypal.com |
| 5 | ทดสอบ | Checkout → PayPal → login **Sandbox Personal** → จ่ายครบ → หน้าเว็บ **ไม่ควร** ขึ้นข้อความเหลืองว่าไม่อัปเดตออเดอร์ |

**เช็กว่า order-paid ทำงาน (ทดสอบมือ):** แทนที่ URL และค่าให้ตรงร้านคุณ

```bash
curl -sS -X POST "https://cms.yardsaleth.com/wp-json/yardsale/v1/order-paid" \
  -H "Content-Type: application/json" \
  -d '{"order_id":1234,"secret":"YOUR_ORDER_PAID_SECRET"}'
```

ถ้าได้ `success: true` แปลว่า WordPress รับ secret ถูกแล้ว — ถ้าได้ 403 แปลว่า secret ไม่ตรงหรือยังไม่ได้ define

**Log บน Nuxt:** ถ้าเห็น `capture_ok_woocommerce_skipped` = ยังไม่มี `ORDER_PAID_SECRET` บน Nuxt หรือ container ยังไม่ restart หลังแก้ env

### 3) บัญชีทดสอบชำระเงิน

ใน Dashboard → **Sandbox** → **Accounts** จะมี:

- **Business** (ร้านค้า) — ผูกกับ App แล้ว
- **Personal** (ลูกค้า) — ใช้ **email + password** ตรงนี้ login ตอน popup PayPal ตอนเทส

### 4) Flow ทดสอบบนเว็บคุณ

1. Login → ใส่สินค้าในตะกร้า → Checkout → กดชำระเงิน → เลือก **PayPal**
2. หน้า `/payment-paypal` → กดปุ่ม PayPal → login ด้วย **Sandbox Personal** account
3. อนุมัติการชำระ → ควร redirect ไป `/payment-successful`
4. ตรวจ WooCommerce ออเดอร์ว่าเป็น **Processing** (ต้องตั้ง `ORDER_PAID_SECRET` ใน Nuxt + WordPress)

### 5) ถ้า error

| อาการ | แนวทาง |
|--------|--------|
| `PayPal credentials not configured` | ใส่ `NUXT_PUBLIC_PAYPAL_CLIENT_ID` และ `PAYPAL_CLIENT_SECRET` |
| `401` / token failed | Client ID กับ Secret ไม่ตรงกันหรือใช้ Live กับ Sandbox สลับกัน |
| `INVALID_CURRENCY` | บาง sandbox account ไม่รองรับ THB — ใช้คู่ `PAYPAL_ORDER_CURRENCY=USD` + `NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY=USD` (แปลงยอดด้วย `PAYPAL_SANDBOX_THB_TO_USD`) หรือตรวจว่า Business sandbox รองรับ THB |
| `COMPLIANCE_VIOLATION` / address verify fail | Create order ใช้ **minimal** + `NO_SHIPPING` อยู่แล้ว; ถ้ายังติด ลอง **USD sandbox** (`PAYPAL_ORDER_CURRENCY` + `NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY`) และชำระแค่ปุ่มเข้าสู่ระบบ PayPal (ไม่ใช้บัตรในวิดเจ็ต) |
| Console: `scf_fetch_credit_form_submit_error` / `scf_unhandled_error_on_submit_COMPLIANCE_VIOLATION` | มาจาก **ปุ่มชำระด้วยบัตรในวิดเจ็ต PayPal** (Hosted Card Fields) — ใช้แค่ “เข้าสู่ระบบ PayPal” ในหน้าชำระ PayPal |
| ปุ่ม PayPal ไม่ขึ้น | ดู Console ว่า SDK โหลดได้; ตรวจ adblock |
| Log `capture_missing_custom_id` | มาจาก **build เก่า** — เวอร์ชันปัจจุบันใช้ minimal order (ไม่มี `custom_id`) และต้องมี `woocommerce_order_id` ใน `POST /api/paypal-capture-order`; **deploy โค้ดล่าสุด** + refresh หน้า `/payment-paypal` ถ้ายังเจอ `capture_missing_woocommerce_order_id` แปลว่า body ไม่มี `woocommerce_order_id` |
| `FetchError [POST] ".../paypal-capture-order": 400` | ดู **ข้อความจริงจาก API** บนหน้า (หลัง deploy ล่าสุด): มักเป็น `woocommerce_order_id is required`, `orderID is required`, `woocommerce_order_id does not match`, หรือ `PayPal capture status: …` — ตรวจ Network tab → response JSON field `message` |
| Log `capture_ok_woocommerce_skipped` | **PayPal capture สำเร็จแล้ว** แต่ Nuxt **ไม่มี `ORDER_PAID_SECRET`** — ใส่ใน Dokploy / `.env` ให้ตรงกับ `define('ORDER_PAID_SECRET', ...)` ใน WordPress แล้ว restart container |

SDK โหลดจาก `https://www.paypal.com/sdk/js?client-id=...` — โหมด sandbox/live ขึ้นกับ **ค่า Client ID** ที่ใส่ ไม่ต้องเปลี่ยน URL

### Minimal order body (สร้างออเดอร์ PayPal)

ส่งให้ PayPal เฉพาะโครงแบบนี้ (ไม่มี `brand_name`, `locale`, `custom_id`, `return_url`):

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{ "amount": { "currency_code": "THB", "value": "100.00" } }],
  "application_context": { "shipping_preference": "NO_SHIPPING" }
}
```

ยอด/สกุลจริงมาจาก checkout; Sandbox แปลง THB→USD ได้ตาม `PAYPAL_ORDER_CURRENCY` ใน `paypal-create-order.post.ts`.

**ความปลอดภัย:** ควรตรวจยอด capture กับยอดออเดอร์ WooCommerce ฝั่งเซิร์ฟเวอร์ก่อน `order-paid` (แนะนำใน Production hardening ด้านบน)
