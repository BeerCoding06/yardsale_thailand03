# WooCommerce: ลดสต็อกเฉพาะออเดอร์ที่ชำระแล้ว (Yardsale plugin)

## เป้าหมาย

- ลด `_stock` **เฉพาะ**เมื่อออเดอร์อยู่ในสถานะที่กำหนด (ค่าเริ่มต้น: **`processing`**, **`completed`**)
- **ไม่**ลดสต็อกตอน **`pending`**, **`failed`**, **`cancelled`**, **`on-hold`** (ยกเว้นปรับรายการสถานะด้านล่าง)

> ค่าเริ่มต้นของปลั๊กอิน: **ปิด** — ต้องเปิดใน `wp-config.php` เองเพื่อไม่เปลี่ยนพฤติกรรมร้านที่ตั้ง WC ให้ลดสต็อกตอนสร้างออเดอร์อยู่แล้ว

---

## 1. เปิดใช้ (wp-config.php)

```php
define('YARDSALE_STOCK_REDUCE_ONLY_PROCESSING_COMPLETED', true);
```

### กำหนดสถานะที่อนุญาตให้ลดสต็อก (ไม่บังคับ)

```php
define('YARDSALE_STOCK_REDUCE_STATUSES', 'processing,completed');
```

หรือใช้ filter:

```php
add_filter('yardsale_wc_reduce_allowed_order_statuses', function ($statuses) {
    return array('processing', 'completed', 'on-hold'); // ตัวอย่าง: รวม on-hold
});
```

---

## 2. Hook ที่ใช้ในปลั๊กอิน

| Hook | หน้าที่ |
|------|---------|
| **`woocommerce_can_reduce_order_stock`** | คืน `false` ถ้าสถานะออเดอร์ไม่อยู่ในรายการอนุญาต (เมื่อเปิดค่าด้านบน) |
| **`woocommerce_payment_complete`** | บันทึก log ก่อน/หลัง (เมื่อ **`YARDSALE_DEBUG_STOCK`** เปิด) |
| **`woocommerce_reduce_order_stock`** / **`woocommerce_restore_order_stock`** | ล้าง **product transients** (`wc_delete_product_transients`) หลังลด/คืนสต็อก |
| **`woocommerce_checkout_process`** | log ตะกร้า (เฉพาะ WC checkout มาตรฐาน + debug เปิด) |

การเรียก **`$order->payment_complete()`** ใน **`yardsale_order_paid`** มีอยู่แล้ว — หลังชำระเงินสถานะจะไป **processing** แล้ว WC จะลดสต็อกเมื่อ filter อนุญาต

---

## 3. Reserved stock / หน้าร้าน Nuxt

- ตาราง **`wp_wc_reserved_stock`** ยังใช้สำหรับ **Hold stock** ของออเดอร์ค้าง — ถ้าต้องการไม่ให้หักจองในสูตร batch ของ Yardsale:

```php
add_filter('yardsale_reserved_stock_sum_for_product', function ($sum, $product_id) {
    return 0; // ใช้เฉพาะเมื่อเข้าใจผลกระทบ (อาจ oversell)
}, 10, 2);
```

- หน้าร้าน headless ใช้ **`/api/check-cart-stock`** + **`product-stock-batch`** — ดู [WOOCOMMERCE-STOCK-RESERVED.md](./WOOCOMMERCE-STOCK-RESERVED.md)

---

## 4. Debug

```php
define('YARDSALE_DEBUG_STOCK', true);
define('WP_DEBUG_LOG', true);
```

ดู `debug.log`: `[yardsale_stock_policy]`, `[yardsale_stock_debug]`

Nuxt:

```bash
NUXT_DEBUG_CART_STOCK=true
```

---

## 5. Sync `_stock` / `_stock_status`

ถ้า `_stock > 0` แต่ `_stock_status` ค้าง `outofstock` — แก้ในแอดมินหรือ SQL (มีตัวอย่างใน [WOOCOMMERCE-STOCK-RESERVED.md](./WOOCOMMERCE-STOCK-RESERVED.md))

---

## 6. สิ่งที่ไม่ทำในโค้ด (เจตนา)

- **ไม่**บังคับ `woocommerce_checkout_process` ให้ข้าม validation ของ WC — เสี่ยง oversell
- **ไม่**ปิด Hold stock อัตโนมัติ — ใช้การตั้งค่า WC + ยกเลิกออเดอร์ค้าง / cron

---

## Related

- [WOOCOMMERCE-STOCK-RESERVED.md](./WOOCOMMERCE-STOCK-RESERVED.md)  
- [WOOCOMMERCE-STOCK-TROUBLESHOOTING.md](./WOOCOMMERCE-STOCK-TROUBLESHOOTING.md)  
- [PAYPAL-INTEGRATION.md](./PAYPAL-INTEGRATION.md)
