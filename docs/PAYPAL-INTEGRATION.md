# PayPal Smart Buttons + WooCommerce (Nuxt 3)

## Architecture

| Layer | Responsibility |
|-------|------------------|
| Browser | Loads PayPal JS SDK with **public** Client ID only. Renders Smart Buttons. |
| `POST /api/paypal-create-order` | OAuth + `POST /v2/checkout/orders` with **secret** (server). Embeds WooCommerce `order_id` in `purchase_units[].custom_id`. |
| `POST /api/paypal-capture-order` | `POST /v2/checkout/orders/{id}/capture`, then calls WordPress `yardsale/v1/order-paid` to set WooCommerce **processing** + `payment_complete()`. |

Secrets never leave the server.

## Environment variables

```env
# Public (exposed to browser for SDK – use sandbox ID in dev)
NUXT_PUBLIC_PAYPAL_CLIENT_ID=AeA1QIZXiflr1_-...

# Server-only
PAYPAL_CLIENT_SECRET=EL1tUJ...

# sandbox | live
PAYPAL_ENVIRONMENT=sandbox

# (ทางเลือก) ลด COMPLIANCE_VIOLATION / address verify — ค่าเริ่มต้น: sandbox = NO_SHIPPING, live = GET_FROM_FILE
# PAYPAL_SHIPPING_PREFERENCE=NO_SHIPPING
# PAYPAL_LOCALE=en-US
# PAYPAL_LANDING_PAGE=NO_PREFERENCE

# (ทางเลือก Sandbox) ส่ง PayPal เป็น USD แทน THB — ต้องตั้งคู่กับ public ด้านล่าง
# PAYPAL_ORDER_CURRENCY=USD
# PAYPAL_SANDBOX_THB_TO_USD=0.029
# NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY=USD

# Same secret as Omise flow – WordPress plugin order-paid
OMISE_ORDER_PAID_SECRET=your_random_secret_string
```

WordPress `wp-config.php`:

```php
define('OMISE_ORDER_PAID_SECRET', 'your_random_secret_string');
```

## Files

- `server/utils/paypal.ts` – access token, create order, capture
- `server/api/paypal-create-order.post.ts`
- `server/api/paypal-capture-order.post.ts`
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

## WooCommerce order update (already implemented)

`paypal-capture-order` calls:

`POST {WP_BASE_URL}/wp-json/yardsale/v1/order-paid`

Body:

```json
{ "order_id": 1234, "secret": "OMISE_ORDER_PAID_SECRET" }
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
2. **Auth** – Require logged-in user JWT on create/capture if only the buyer should pay their order.
3. **Idempotency** – PayPal supports `PayPal-Request-Id` on create (already sent). Handle duplicate capture responses if user retries.
4. **Webhooks** – Optional: subscribe to PayPal webhooks for `PAYMENT.CAPTURE.COMPLETED` as a backup to mark orders paid.

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
OMISE_ORDER_PAID_SECRET=<ตรงกับ WordPress>
```

รีสตาร์ท dev server หลังแก้ `.env`

**สำคัญ:** Client ID / Secret ต้องเป็นคู่จาก **Sandbox** เท่านั้น ถ้าเอา Live มาใส่จะ error ตอน token หรือ create order

### 3) บัญชีทดสอบชำระเงิน

ใน Dashboard → **Sandbox** → **Accounts** จะมี:

- **Business** (ร้านค้า) — ผูกกับ App แล้ว
- **Personal** (ลูกค้า) — ใช้ **email + password** ตรงนี้ login ตอน popup PayPal ตอนเทส

### 4) Flow ทดสอบบนเว็บคุณ

1. Login → ใส่สินค้าในตะกร้า → Checkout → กดชำระเงิน → เลือก **PayPal**
2. หน้า `/payment-paypal` → กดปุ่ม PayPal → login ด้วย **Sandbox Personal** account
3. อนุมัติการชำระ → ควร redirect ไป `/payment-successful`
4. ตรวจ WooCommerce ออเดอร์ว่าเป็น **Processing** (ต้องตั้ง `OMISE_ORDER_PAID_SECRET` ใน Nuxt + WordPress)

### 5) ถ้า error

| อาการ | แนวทาง |
|--------|--------|
| `PayPal credentials not configured` | ใส่ `NUXT_PUBLIC_PAYPAL_CLIENT_ID` และ `PAYPAL_CLIENT_SECRET` |
| `401` / token failed | Client ID กับ Secret ไม่ตรงกันหรือใช้ Live กับ Sandbox สลับกัน |
| `INVALID_CURRENCY` | บาง sandbox account ไม่รองรับ THB — ใช้คู่ `PAYPAL_ORDER_CURRENCY=USD` + `NUXT_PUBLIC_PAYPAL_CHECKOUT_CURRENCY=USD` (แปลงยอดด้วย `PAYPAL_SANDBOX_THB_TO_USD`) หรือตรวจว่า Business sandbox รองรับ THB |
| `COMPLIANCE_VIOLATION` / address verify fail | มักมาจาก **ที่อยู่ + sandbox + สกุลเงิน**: (1) server ส่ง `shipping_preference=NO_SHIPPING` ใน sandbox อยู่แล้ว (override ด้วย `PAYPAL_SHIPPING_PREFERENCE`) (2) ตั้ง `PAYPAL_LOCALE=en-US` (3) ถ้ายังติด ลอง USD mode ตามบรรทัดด้านบน |
| ปุ่ม PayPal ไม่ขึ้น | ดู Console ว่า SDK โหลดได้; ตรวจ adblock |

SDK โหลดจาก `https://www.paypal.com/sdk/js?client-id=...` — โหมด sandbox/live ขึ้นกับ **ค่า Client ID** ที่ใส่ ไม่ต้องเปลี่ยน URL

### `application_context` ที่เซิร์ฟเวอร์ส่งให้ PayPal

- `shipping_preference`: default **NO_SHIPPING** เมื่อ `PAYPAL_ENVIRONMENT=sandbox`, มิฉะนั้น **GET_FROM_FILE** (ร้านที่ต้องเก็บที่อยู่จริงใน production อาจตั้ง `PAYPAL_SHIPPING_PREFERENCE=SET_PROVIDED_ADDRESS` และส่งที่อยู่ใน order ตามแผนอนาคต)
- `locale`: default **en-US** (sandbox), **th-TH** (live) — แก้ด้วย `PAYPAL_LOCALE`
