# วิธีทดสอบ PHP API ผ่าน Postman

## ข้อมูล API Endpoint

### URL:

```
http://localhost/yardsale_thailand/server/api/php/createProducts.php
```

### Method:

```
POST
```

---

## วิธีตั้งค่าใน Postman:

### ขั้นตอนที่ 1: ตั้งค่า Request

1. เปิด Postman
2. สร้าง Request ใหม่
3. เลือก Method: **POST**
4. ใส่ URL: `http://localhost/yardsale_thailand/server/api/php/createProducts.php`

---

### ขั้นตอนที่ 2: ตั้งค่า Headers

ไปที่ tab **Headers** และเพิ่ม:

| Key            | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

---

### ขั้นตอนที่ 3: ตั้งค่า Body

1. ไปที่ tab **Body**
2. เลือก **raw**
3. เลือก **JSON** (จาก dropdown ด้านขวา)
4. ใส่ JSON body:

#### ตัวอย่างที่ 1: ข้อมูลขั้นต่ำ (Required fields only)

```json
{
  "name": "Test Product Postman",
  "type": "simple",
  "regular_price": "199"
}
```

#### ตัวอย่างที่ 2: ข้อมูลครบถ้วน

```json
{
  "name": "Test Product Postman",
  "type": "simple",
  "regular_price": "199",
  "description": "This is a test product created via Postman",
  "short_description": "Test product",
  "sku": "TEST-001",
  "manage_stock": true,
  "stock_quantity": 100,
  "sale_price": "149"
}
```

---

### ขั้นตอนที่ 4: ส่ง Request

1. คลิก **Send**
2. ดู Response ที่ได้

---

## Response ที่คาดหวัง:

### ✅ Success (200 OK):

```json
{
  "id": 123,
  "name": "Test Product Postman",
  "type": "simple",
  "status": "draft",
  "regular_price": "199",
  ...
}
```

### ❌ Error - Missing Required Fields (400 Bad Request):

```json
{
  "error": "Missing required fields: name, type, regular_price"
}
```

### ❌ Error - WP_BASIC_AUTH not set (500 Internal Server Error):

```json
{
  "error": "WP_BASIC_AUTH is not set in .env file"
}
```

### ❌ Error - cURL Error (500 Internal Server Error):

```json
{
  "error": "cURL Error: ..."
}
```

---

## Required Fields:

- `name` (string) - ชื่อสินค้า
- `type` (string) - ประเภทสินค้า (เช่น "simple", "variable", "grouped")
- `regular_price` (string) - ราคาปกติ

---

## Optional Fields:

- `description` (string) - คำอธิบายสินค้า
- `short_description` (string) - คำอธิบายสั้นๆ
- `sku` (string) - SKU ของสินค้า
- `manage_stock` (boolean) - จัดการสต็อกหรือไม่
- `stock_quantity` (number) - จำนวนสต็อก
- `categories` (array) - หมวดหมู่สินค้า
- `images` (array) - รูปภาพสินค้า
- `sale_price` (string) - ราคาขาย

---

## หมายเหตุ:

1. **ไฟล์ `.env` ต้องมี:**

   - `WP_MEDIA_HOST=http://localhost/yardsale_thailand/wordpress`
   - `WP_BASIC_AUTH=cGFyYWRvbl9wb2twaW5nbWF1bmc6eDRkTCA4QUp1IHQzSHkgZzIyMyA5aTViIG9hTnk=`

2. **PHP API จะส่ง request ไปที่ WooCommerce REST API:**

   - URL: `http://localhost/yardsale_thailand/wordpress/wp-json/wc/v3/products`
   - Method: POST
   - Headers: `Content-Type: application/json`, `Authorization: Basic {WP_BASIC_AUTH}`

3. **Response จาก PHP API จะเป็น response จาก WooCommerce API โดยตรง**

---

## Troubleshooting:

### ถ้าได้ Error 404:

- ตรวจสอบว่า URL ถูกต้อง
- ตรวจสอบว่า MAMP/Apache กำลังรันอยู่
- ตรวจสอบว่าไฟล์ PHP อยู่ในตำแหน่งที่ถูกต้อง

### ถ้าได้ Error 500 - WP_BASIC_AUTH not set:

- ตรวจสอบว่าไฟล์ `.env` อยู่ในตำแหน่งที่ถูกต้อง: `/Applications/MAMP/htdocs/yardsale_thailand/.env`
- ตรวจสอบว่า `WP_BASIC_AUTH` ถูกตั้งค่าใน `.env`

### ถ้าได้ Error 401/403 จาก WooCommerce:

- ตรวจสอบว่า `WP_BASIC_AUTH` ถูกต้อง
- ตรวจสอบว่า User ที่ใช้สร้าง Application Password มีสิทธิ์ Administrator หรือ Shop Manager

---

## ตัวอย่าง Request ใน Postman:

### Request:

```
POST http://localhost/yardsale_thailand/server/api/php/createProducts.php
Content-Type: application/json

{
  "name": "Test Product Postman",
  "type": "simple",
  "regular_price": "199"
}
```

### Response (Success):

```json
{
  "id": 123,
  "name": "Test Product Postman",
  "type": "simple",
  "status": "draft",
  "regular_price": "199",
  "permalink": "http://localhost/yardsale_thailand/wordpress/product/test-product-postman/",
  ...
}
```

---

ลองทดสอบใน Postman แล้วแจ้งผลลัพธ์!
