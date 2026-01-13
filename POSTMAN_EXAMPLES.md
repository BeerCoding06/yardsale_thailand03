# ตัวอย่าง JSON Body สำหรับ Postman

## ตัวอย่างที่ 1: ข้อมูลขั้นต่ำ (Required fields only)

```json
{
  "name": "Test Product Postman",
  "type": "simple",
  "regular_price": "199"
}
```

**ผลลัพธ์:**

- Status: `draft` (อัตโนมัติ)
- SKU: `TEST-PRODUCT-POSTMAN-123456` (สร้างอัตโนมัติ)

---

## ตัวอย่างที่ 2: พร้อม Thumbnail (Featured Image)

### ใช้ Media ID:

```json
{
  "name": "Test Product with Thumbnail",
  "type": "simple",
  "regular_price": "299",
  "thumb": 123
}
```

### ใช้ Image URL:

```json
{
  "name": "Test Product with Thumbnail",
  "type": "simple",
  "regular_price": "299",
  "thumb": "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/product-image.jpg"
}
```

**หมายเหตุ:**

- `thumb` จะถูกตั้งเป็น featured image (รูปภาพหลัก)
- ถ้าใช้ Media ID: ใส่ตัวเลข (เช่น `123`)
- ถ้าใช้ URL: ใส่ URL เต็มของรูปภาพ

---

## ตัวอย่างที่ 3: พร้อม Gallery Images

### ใช้ Media IDs:

```json
{
  "name": "Test Product with Gallery",
  "type": "simple",
  "regular_price": "399",
  "gallery": [124, 125, 126]
}
```

### ใช้ Image URLs:

```json
{
  "name": "Test Product with Gallery",
  "type": "simple",
  "regular_price": "399",
  "gallery": [
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/image1.jpg",
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/image2.jpg",
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/image3.jpg"
  ]
}
```

**หมายเหตุ:**

- `gallery` ต้องเป็น array
- รูปภาพใน gallery จะถูกเพิ่มเป็น gallery images (ไม่ใช่ featured image)

---

## ตัวอย่างที่ 4: พร้อม Thumbnail และ Gallery

### ใช้ Media IDs:

```json
{
  "name": "Test Product Complete",
  "type": "simple",
  "regular_price": "499",
  "thumb": 123,
  "gallery": [124, 125, 126]
}
```

### ใช้ Image URLs:

```json
{
  "name": "Test Product Complete",
  "type": "simple",
  "regular_price": "499",
  "thumb": "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/featured.jpg",
  "gallery": [
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/gallery1.jpg",
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/gallery2.jpg",
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/gallery3.jpg"
  ]
}
```

**หมายเหตุ:**

- `thumb` = Featured Image (รูปภาพหลัก)
- `gallery` = Gallery Images (รูปภาพเพิ่มเติม)
- รูปภาพใน gallery จะไม่ซ้ำกับ thumb อัตโนมัติ

---

## ตัวอย่างที่ 5: พร้อม Brand, Thumbnail, และ Gallery

### ใช้ Media IDs:

```json
{
  "name": "Test Product with Brand",
  "type": "simple",
  "regular_price": "599",
  "brand": "Nike",
  "thumb": 123,
  "gallery": [124, 125, 126]
}
```

### ใช้ Image URLs:

```json
{
  "name": "Test Product with Brand",
  "type": "simple",
  "regular_price": "599",
  "brand": "Nike",
  "thumb": "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/featured.jpg",
  "gallery": [
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/gallery1.jpg",
    "http://localhost/yardsale_thailand/wordpress/wp-content/uploads/2024/01/gallery2.jpg"
  ]
}
```

**หมายเหตุ:**

- `brand` จะถูกเพิ่มเป็น custom attribute ชื่อ "brand"
- สามารถใช้ brand เป็น string หรือ array ก็ได้

---

## ตัวอย่างที่ 5.1: พร้อม Tags (ป้ายกำกับ)

### ใช้ Tag Names (จะสร้าง tag ใหม่ถ้ายังไม่มี):

```json
{
  "name": "Test Product with Tags",
  "type": "simple",
  "regular_price": "699",
  "tags": ["premium", "new", "featured", "bestseller"]
}
```

### ใช้ Tag IDs:

```json
{
  "name": "Test Product with Tags",
  "type": "simple",
  "regular_price": "699",
  "tags": [10, 11, 12, 13]
}
```

**หมายเหตุ:**

- `tags` ต้องเป็น array
- ถ้าใช้ tag names (string) = จะสร้าง tag ใหม่ถ้ายังไม่มี
- ถ้าใช้ tag IDs (number) = ต้องมี tag อยู่แล้วใน WordPress

---

## ตัวอย่างที่ 5.2: พร้อม Brand และ Tags

```json
{
  "name": "Test Product with Brand and Tags",
  "type": "simple",
  "regular_price": "799",
  "brand": "Nike",
  "tags": ["premium", "new", "featured", "bestseller"]
}
```

---

## ตัวอย่างที่ 6: ข้อมูลครบถ้วน

```json
{
  "name": "Premium Product",
  "type": "simple",
  "regular_price": "999",
  "sale_price": "799",
  "description": "This is a premium product with full features",
  "short_description": "Premium product",
  "sku": "PREMIUM-001",
  "brand": "Apple",
  "tags": ["premium", "new", "featured", "bestseller"],
  "thumb": 123,
  "gallery": [124, 125, 126, 127],
  "manage_stock": true,
  "stock_quantity": 50,
  "categories": [
    {
      "id": 10
    }
  ]
}
```

---

## วิธีหา Media ID:

### วิธีที่ 1: ผ่าน WordPress Admin

1. ไปที่ `wp-admin → Media → Library`
2. คลิกที่รูปภาพที่ต้องการ
3. ดู URL ใน address bar: `wp-admin/upload.php?item=123`
   - `123` คือ Media ID

### วิธีที่ 2: ผ่าน WordPress REST API

```
GET http://localhost/yardsale_thailand/wordpress/wp-json/wp/v2/media
```

Response จะมี `id` ของแต่ละ media item

---

## วิธีหา Image URL:

### วิธีที่ 1: ผ่าน WordPress Admin

1. ไปที่ `wp-admin → Media → Library`
2. คลิกที่รูปภาพที่ต้องการ
3. คัดลอก URL จาก "File URL" หรือ "Copy URL"

### วิธีที่ 2: ดูจาก Media Library

URL format:

```
http://localhost/yardsale_thailand/wordpress/wp-content/uploads/YYYY/MM/filename.jpg
```

---

## สรุป:

### Required Fields:

- `name` (string) - ชื่อสินค้า
- `type` (string) - ประเภทสินค้า (เช่น "simple")
- `regular_price` (string) - ราคาปกติ

### Optional Fields:

- `thumb` (number หรือ string) - Featured Image (Media ID หรือ URL)
- `gallery` (array) - Gallery Images (array ของ Media IDs หรือ URLs)
- `brand` (string) - ยี่ห้อสินค้า
- `tags` (array) - ป้ายกำกับสินค้า (array ของ tag names หรือ tag IDs)
- `description` (string) - คำอธิบายสินค้า
- `short_description` (string) - คำอธิบายสั้นๆ
- `sku` (string) - SKU ของสินค้า (ถ้าไม่ใส่จะสร้างอัตโนมัติ)
- `sale_price` (string) - ราคาขาย
- `manage_stock` (boolean) - จัดการสต็อกหรือไม่
- `stock_quantity` (number) - จำนวนสต็อก
- `categories` (array) - หมวดหมู่สินค้า

---

## หมายเหตุ:

1. **Status**: จะถูกตั้งเป็น `draft` อัตโนมัติ
2. **SKU**: ถ้าไม่ส่ง `sku` จะสร้างอัตโนมัติ (format: `PRODUCT-NAME-TIMESTAMP`)
3. **Thumbnail**: จะถูกตั้งเป็น featured image (รูปภาพหลัก)
4. **Gallery**: รูปภาพใน gallery จะไม่ซ้ำกับ thumb อัตโนมัติ
5. **Media ID vs URL**:
   - ใช้ Media ID (ตัวเลข) = รูปภาพต้องอัปโหลดใน WordPress Media Library แล้ว
   - ใช้ URL = รูปภาพสามารถเป็น external URL หรือ URL ของรูปภาพที่อัปโหลดแล้ว

---

ลองทดสอบใน Postman แล้วแจ้งผลลัพธ์!
