# WooCommerce stock sync — troubleshooting (Nuxt + Yardsale)

## รีเฟรชสต็อกตอนเปิดหน้า Checkout (Nuxt)

- ตอนเข้าหน้า **Checkout** แอปจะเรียก **`POST /api/refresh-cart-stock`** แล้วอัปเดต `stockQuantity` / `stockStatus` ในรายการตะกร้า (localStorage) ให้ตรงกับ WooCommerce + ปลั๊กอิน (รวม reserved เมื่อใช้ `wc_only`)
- ลดกรณีข้อความสีเหลือง “out of stock” จาก **snapshot เก่าตอนกดเพิ่มตะกร้า**

---

## Symptom

- **Inventory in wp-admin looks fine** (high `stock_quantity`, “In stock”).
- **After one successful purchase**, checkout or “add to cart” **blocks** (insufficient stock / out of stock).

---

## Root cause (this codebase)

### 1. Double stock deduction (`NUXT_STOCK_SUBTRACT_PAID` / `subtract_paid`)

Yardsale can compute:

`effective = max(0, WooCommerce_stock_quantity − sum(qty in paid/processing orders))`

WooCommerce **already decreases** `_stock` when:

- the order is created (if **Settings → Products → Inventory → “Reduce stock on order placement”** is on), and/or  
- payment completes (`payment_complete()` / processing), depending on your WC version and settings.

Then:

- `WC_stock` = remaining after WC logic  
- `paid_qty` = units already sold in those orders  

Subtracting **both** makes the storefront think stock is **lower than reality** (roughly “remaining − sold again”). After enough orders, **effective hits 0** while admin still shows stock.

**Fix:** Keep the default **`stockSubtractPaidOrders: false`** (opt-in with `NUXT_STOCK_SUBTRACT_PAID=true` only if WC truly does *not* reduce stock). See [STOCK-PAID-DEDUCTION.md](./STOCK-PAID-DEDUCTION.md).

### 2. Stale product API cache

`/api/product` was cached briefly; under load you could see **old** `stock_quantity`. It is now **`maxAge: 0`** so each request gets fresh data.

### 3. `stock_status` vs `stock_quantity` mismatch

WooCommerce can leave **`outofstock`** while quantity is still &gt; 0 (plugins, imports, REST updates).  
`isCartLineSalableBySnapshot` (client + server) **allows** purchase when `stock_quantity >= qty` even if status says out of stock — but **`check-cart-stock`** still uses status messages; fix WC catalog or run **WooCommerce → Status → Tools** to sync stock status if needed.

### 4. Listing filters

`getProducts.php` / `searchProducts.php` use `stock_status=instock`. If WC marks the product **out of stock** (even wrongly), it **disappears from listings** while still looking “in stock” in the single product screen — verify the **same variation** and **same product ID** in admin.

---

## Debugging checklist

### WooCommerce (wp-admin)

1. **Product → Inventory**  
   - [ ] **Manage stock** enabled/disabled as intended  
   - [ ] **Stock quantity** matches expectations  
   - [ ] **Stock status** = In stock (or let WC derive from qty)  
   - [ ] **Allow backorders** = No (unless you want backorders)

2. **WooCommerce → Settings → Products → Inventory**  
   - [ ] **Manage stock** (global)  
   - [ ] **Hold stock (minutes)** — pending orders reserve stock  
   - [ ] **When to reduce stock** — on order vs on payment (note which you use)

3. **After a test order**  
   - [ ] Open the product (and **each variation** if variable) and confirm `_stock` decreased **once** per unit sold, not twice.  
   - [ ] Order status flow: `pending` → `processing` after payment (Yardsale `order-paid` calls `payment_complete()`).

### API (raw truth)

```bash
# Replace HOST, KEY, SECRET, ID
curl -s "https://HOST/wp-json/wc/v3/products/ID?consumer_key=KEY&consumer_secret=SECRET" \
  | jq '{id, manage_stock, stock_quantity, stock_status, type}'
```

For variations:

```bash
curl -s "https://HOST/wp-json/wc/v3/products/PARENT_ID/variations/VAR_ID?consumer_key=KEY&consumer_secret=SECRET" \
  | jq '{id, stock_quantity, stock_status}'
```

Compare with what Nuxt shows on `/api/product?id=...`.

### Nuxt / env

- [ ] **`NUXT_STOCK_SUBTRACT_PAID`** unset or **`false`** unless you explicitly need `subtract_paid`.  
- [ ] No CDN/HTML cache serving **old** product pages for logged-in checkout (if you use full-page cache, exclude checkout or shorten TTL).

### Custom code

- [ ] **`yardsale_update_product` / `updateProduct.php`** — only send `stock_quantity` / `stock_status` when you intend to change them; accidental `0` or `outofstock` overwrites WC.  
- [ ] No other plugin **forcing** stock to 0 on order.

---

## Correct API usage (update stock)

Prefer **WooCommerce REST** or **`wc_get_product()` + `set_stock_quantity()` + `save()`** — let WC update **`stock_status`** from quantity when possible:

```php
$product = wc_get_product( $id );
$product->set_manage_stock( true );
$product->set_stock_quantity( 10 );
$product->save(); // refreshes stock status from qty
```

Avoid setting **`stock_status` to `outofstock`** manually while **`stock_quantity > 0`** unless you mean to block sales regardless of qty.

---

## Order creation (Yardsale plugin)

`yardsale_create_order` uses `wc_create_order` + `add_product()` + default status **`pending``. Stock reduction follows **your WC inventory settings** for pending orders.  
`yardsale_order_paid` calls **`payment_complete()`**, which triggers normal WC “paid” behavior (including stock rules for payment time).

Do **not** add custom code that sets product stock to **0** after each order unless that is the business rule.

---

## Quick fix summary

| Issue | Action |
|--------|--------|
| Double deduction | `NUXT_STOCK_SUBTRACT_PAID` **not** `true` (default off) |
| Stale stock on product page | `/api/product` cache **disabled** (`maxAge: 0`) |
| Status vs qty wrong | Fix in WC admin or REST; use `save()` after qty change |
| Variable product | Always use **variation ID** for stock in cart/checkout APIs |

---

## Related docs

- [STOCK-PAID-DEDUCTION.md](./STOCK-PAID-DEDUCTION.md) — when to enable `subtract_paid`  
- [PAYPAL-INTEGRATION.md](./PAYPAL-INTEGRATION.md) — `order-paid` / `payment_complete()`  
- [WOOCOMMERCE-STOCK-RESERVED.md](./WOOCOMMERCE-STOCK-RESERVED.md) — hold stock, `wp_wc_reserved_stock`, SQL, `YARDSALE_DEBUG_STOCK`  
- [WOOCOMMERCE-STOCK-REDUCTION-POLICY.md](./WOOCOMMERCE-STOCK-REDUCTION-POLICY.md) — ลดสต็อกเฉพาะ `processing`/`completed` (opt-in)
