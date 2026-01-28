# PHP API Endpoints

PHP API endpoints ที่ดึงข้อมูลจาก WooCommerce REST API

## Configuration

ตั้งค่า credentials ใน `.env` file:
```
WP_BASE_URL=http://157.85.98.150:8080
WP_CONSUMER_KEY=ck_c079fe80d163d7fd5d1f0bccfe2d198ece614ca4
WP_CONSUMER_SECRET=cs_787ef53ac512d8cb7a80aec2bffd73476a317afe
```

หรือแก้ไขใน `config.php` โดยตรง

## API Endpoints

### Products

#### GET `/server/api/php/getProducts.php`
ดึง products หลายตัว

**Query Parameters:**
- `page` - หน้า (default: 1)
- `per_page` - จำนวนต่อหน้า (default: 21)
- `search` - ค้นหา
- `category` - หมวดหมู่ ID
- `order` - เรียงลำดับ (asc/desc, default: desc)
- `orderby` - เรียงตาม (date/title/price/rating/popularity, default: date)

**Response:**
```json
{
  "products": {
    "nodes": [...],
    "pageInfo": {
      "hasNextPage": true,
      "endCursor": "..."
    }
  }
}
```

#### GET `/server/api/php/getProduct.php`
ดึง product เดียว

**Query Parameters:**
- `slug` - Product slug
- `sku` - Product SKU
- `id` - Product ID

**Response:**
```json
{
  "product": {
    "databaseId": 123,
    "sku": "...",
    "name": "...",
    "regularPrice": "...",
    "salePrice": "...",
    ...
  }
}
```

#### GET `/server/api/php/searchProducts.php`
ค้นหา products

**Query Parameters:**
- `search` - คำค้นหา (required)
- `limit` - จำนวนผลลัพธ์ (default: 6)

**Response:**
```json
{
  "products": {
    "nodes": [...]
  }
}
```

### Categories

#### GET `/server/api/php/getCategories.php`
ดึง categories

**Query Parameters:**
- `parent` - Parent category ID (default: 0)
- `hide_empty` - ซ่อน category ที่ไม่มี products (default: true)
- `orderby` - เรียงตาม (default: name)
- `order` - เรียงลำดับ (ASC/DESC, default: ASC)

**Response:**
```json
{
  "productCategories": {
    "nodes": [...]
  }
}
```

### Cart

#### POST `/server/api/php/addToCart.php`
เพิ่ม product เข้า cart

**Body:**
```json
{
  "productId": 123
}
```

**Response:**
```json
{
  "addToCart": {
    "cartItem": {
      "key": "simple-123",
      "product": {
        "node": {...}
      },
      "quantity": 1
    }
  }
}
```

### Orders

#### GET `/server/api/php/getOrders.php`
ดึง orders

**Query Parameters:**
- `customer_id` - Customer ID
- `customer_email` - Customer email
- `status` - Order status
- `per_page` - จำนวนต่อหน้า (default: 100)
- `page` - หน้า (default: 1)

**Response:**
```json
{
  "orders": [...],
  "count": 10
}
```

#### GET `/server/api/php/getOrder.php`
ดึง order เดียว

**Query Parameters:**
- `order_id` - Order ID (required)

**Response:**
```json
{
  "order": {...}
}
```

#### POST `/server/api/php/createOrder.php`
สร้าง order ใหม่

**Body:**
```json
{
  "payment_method": "...",
  "payment_method_title": "...",
  "set_paid": false,
  "billing": {...},
  "shipping": {...},
  "line_items": [...],
  ...
}
```

**Response:**
```json
{
  "order": {...}
}
```

## Usage Example

```php
// Fetch products
$url = 'http://localhost/server/api/php/getProducts.php?per_page=10&page=1';
$response = file_get_contents($url);
$data = json_decode($response, true);

// Search products
$url = 'http://localhost/server/api/php/searchProducts.php?search=shirt';
$response = file_get_contents($url);
$data = json_decode($response, true);

// Get single product
$url = 'http://localhost/server/api/php/getProduct.php?slug=product-slug';
$response = file_get_contents($url);
$data = json_decode($response, true);

// Add to cart
$data = ['productId' => 123];
$options = [
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode($data)
    ]
];
$context = stream_context_create($options);
$url = 'http://localhost/server/api/php/addToCart.php';
$response = file_get_contents($url, false, $context);
$result = json_decode($response, true);
```

## Notes

- ทุก endpoint ใช้ WooCommerce REST API (`/wp-json/wc/v3/`)
- Authentication ผ่าน query parameters (`consumer_key` และ `consumer_secret`)
- Categories ใช้ WordPress REST API (`/wp-json/wp/v2/product_cat`) เพราะ WooCommerce API ไม่มี endpoint สำหรับ categories
- Response format ตรงกับที่ Nuxt API endpoints ใช้
