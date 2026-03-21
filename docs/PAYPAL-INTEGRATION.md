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
