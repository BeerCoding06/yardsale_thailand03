# WooCommerce stock: reserved stock, timing, SQL & debug

Use this when **admin shows stock remaining** (e.g. 4) but **checkout says unavailable** (as if 0).

---

## 1. When WooCommerce changes stock

Controlled by **WooCommerce → Settings → Products → Inventory**:

| Setting | Effect |
|--------|--------|
| **Enable stock management** | Global on/off |
| **Hold stock (minutes)** | Pending orders **reserve** stock in `wp_wc_reserved_stock` (WC 4.6+) so other checkouts see less “available” stock |
| **Reduce stock** | Usually **when order is placed** (pending) **or** **when payment completes** — depends on WC version & gateways; avoid reducing **twice** |

Yardsale flow:

1. **`yardsale/v1/create-order`** creates order with status **`pending`** (unless overridden).
2. After PayPal/Omise, Nuxt calls **`PUT wc/v3/orders/{id}`** (`set_paid: true`, `processing`) and/or **`yardsale/v1/order-paid`** → **`$order->payment_complete()`**.

`payment_complete()` marks the order paid and runs WooCommerce’s normal stock logic. WC uses **`_order_stock_reduced`** on the order to avoid double reduction.

---

## 2. Reserved stock (`woocommerce_hold_stock_minutes`)

Option stored in **`wp_options`**:

```sql
SELECT option_name, option_value
FROM wp_options
WHERE option_name IN ('woocommerce_hold_stock_minutes', 'woocommerce_manage_stock', 'woocommerce_notify_low_stock', 'woocommerce_notify_no_stock');
```

- If **hold stock** is **60** minutes, **unpaid pending** orders keep rows in **`wp_wc_reserved_stock`**, reducing **sellable** quantity for new checkouts.
- After payment, WC should **release** reservation for that order when status moves to processing/completed.

Inspect reservations (replace `wp_` with your prefix):

```sql
SELECT * FROM wp_wc_reserved_stock ORDER BY product_id, order_id;
```

---

## 3. Product meta (`_stock`, `_stock_status`)

Simple product ID `123`:

```sql
SELECT post_id, meta_key, meta_value
FROM wp_postmeta
WHERE post_id = 123
  AND meta_key IN ('_stock', '_stock_status', '_manage_stock');
```

Variation: use **variation post ID** (not parent variable product ID).

---

## 4. “Safe” fixes (use with care)

### A. Frontend / Nuxt (no DB)

- Keep **`NUXT_STOCK_SUBTRACT_PAID` unset or `false`** unless WooCommerce **never** reduces stock (see [STOCK-PAID-DEDUCTION.md](./STOCK-PAID-DEDUCTION.md)). Double subtraction blocks checkout early.
- **`/api/product`** uses **`maxAge: 0`** so stock is not cached stale.

### B. Cancel or pay stuck pending orders

In wp-admin: **WooCommerce → Orders** — cancel old **pending** orders that should not hold stock, or complete payment so stock rules run correctly.

### C. Clear **all** reserved stock (maintenance only)

**Backup the database first.** This removes **every** active reservation site-wide:

```sql
-- DANGER: affects all pending reservations
TRUNCATE TABLE wp_wc_reserved_stock;
```

Prefer fixing or cancelling the specific **pending** orders instead.

### D. Fix wrong `_stock` / `_stock_status` for one product

After you know the correct remaining quantity (e.g. 4):

```sql
UPDATE wp_postmeta SET meta_value = '4' WHERE post_id = 123 AND meta_key = '_stock';
UPDATE wp_postmeta SET meta_value = 'instock' WHERE post_id = 123 AND meta_key = '_stock_status';
```

Then in wp-admin open the product and click **Update** once so WooCommerce refreshes caches/object data.

Better: fix in **Products → Edit** so extensions stay in sync.

---

## 5. Payment must complete the order

If the order stays **pending** after the customer paid:

- Stock may stay **reserved** and behaviour depends on “reduce on placement” vs “reduce on payment”.
- Ensure capture/webhook runs **`payment_complete()`** or **REST `set_paid: true` + `processing`**.

Plugin: `yardsale_order_paid` calls **`payment_complete()`**. See [PAYPAL-INTEGRATION.md](./PAYPAL-INTEGRATION.md).

---

## 6. Debug logs (this project)

### WordPress (`wp-config.php`)

```php
define('YARDSALE_DEBUG_STOCK', true);
define('WP_DEBUG_LOG', true);
```

Then reproduce checkout. Watch `wp-content/debug.log` for:

- `[yardsale_stock_debug]` — order status changes, reduce/restore stock hooks, snapshots around **`order-paid`**
- `[yardsale_create_order]` — after order save (pending + stock rules)
- `[yardsale_order_paid]` — after `payment_complete()`

**Turn off** `YARDSALE_DEBUG_STOCK` in production when finished.

### Nuxt (cart stock API)

```bash
NUXT_DEBUG_CART_STOCK=true
```

Server logs will show per-line decisions from **`/api/check-cart-stock`**.

---

## 7. Checklist (5 in stock → 1 sold → 4 left)

- [ ] `_stock` for that SKU/variation is **4** in `wp_postmeta`.
- [ ] `_stock_status` is **instock** (or empty with managed stock).
- [ ] Paid order is **processing** or **completed**, not stuck **pending**.
- [ ] `wp_wc_reserved_stock` has **no** stray rows for that product blocking quantity (or cancel stale pending orders).
- [ ] **`NUXT_STOCK_SUBTRACT_PAID`** is **not** `true` if WC already reduces stock.
- [ ] WooCommerce REST `GET /wc/v3/products/{id}` (or variation) returns **`stock_quantity: 4`**, **`stock_status: instock`**.

---

## Related

- [WOOCOMMERCE-STOCK-TROUBLESHOOTING.md](./WOOCOMMERCE-STOCK-TROUBLESHOOTING.md)
- [STOCK-PAID-DEDUCTION.md](./STOCK-PAID-DEDUCTION.md)
