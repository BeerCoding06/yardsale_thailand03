# สต็อกหลังหักยอดชำระแล้ว (Yardsale + WooCommerce)

## พฤติกรรม

- ปลั๊กอิน WordPress **Yardsale Orders API** นับจำนวนชิ้นจากออเดอร์ที่สถานะ **`processing`**, **`completed`**, **`on-hold`** (รวมรูปแบบ `wc-*`) ต่อรหัสสินค้า WooCommerce (simple = product id, variable = **variation id**)
- โหมด **`subtract_paid`** (ค่าเริ่มต้นฝั่ง Nuxt เมื่อไม่ตั้ง `NUXT_STOCK_SUBTRACT_PAID=false`):

  `effective_stock = max(0, stock_quantity_ใน_WC − จำนวนที่ชำระ/ดำเนินการแล้ว)`

- ใช้กับ:
  - **`GET /api/product`** — หลังดึงสินค้า จะเรียก `yardsale/v1/product-stock-info` แล้วเขียนทับ `stockQuantity` / `stockStatus` ของสินค้าและแต่ละ variation
  - **`POST /api/check-cart-stock`** — เรียก `yardsale/v1/product-stock-batch` แล้วใช้ `effective_quantity` ตรวจก่อนชำระเงิน

## เมื่อ WooCommerce ลดสต็อกตอนชำระเงินอยู่แล้ว

ถ้าเปิดลดสต็อกมาตรฐานของ WooCommerce (`payment_complete()` ฯลฯ) ค่า `stock_quantity` ใน WC **ลดลงแล้ว** — การหัก `paid` ซ้ำจะทำให้สต็อกต่ำเกินจริง

ให้ปิดการหักฝั่ง Yardsale:

```bash
NUXT_STOCK_SUBTRACT_PAID=false
```

## Endpoint ปลั๊กอิน (ไม่ต้อง JWT)

| Method | Path | คำอธิบาย |
|--------|------|-----------|
| GET | `/wp-json/yardsale/v1/product-stock-info?product_id=&formula=subtract_paid\|wc_only` | สินค้าเดียว + variations |
| POST | `/wp-json/yardsale/v1/product-stock-batch` | Body: `{ "ids": [1,2,3], "formula": "subtract_paid" }` |

## ปรับสูตรใน PHP (ขั้นสูง)

```php
add_filter('yardsale_stock_effective_formula', function ($formula, $wc_line_id) {
    return 'wc_only'; // หรือ subtract_paid
}, 10, 2);
```

## รายการสินค้า (หน้าแรก / หมวด)

ตอนนี้การคำนวณนี้ใช้กับ **หน้ารายละเอียดสินค้า** และ **ตรวจตะกร้า** เท่านั้น การ์ดสินค้าในลิสต์ยังใช้ค่าสต็อกจาก WooCommerce โดยตรง (ยังไม่ batch หัก paid)
