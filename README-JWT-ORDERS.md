# JWT Authentication for Orders API

ระบบนี้ใช้ JWT authentication เพื่อดึง orders ของ user ที่ login เท่านั้น

## การติดตั้ง

### 1. ติดตั้ง WordPress Plugin

1. Copy ไฟล์ `wordpress-plugin-yardsale-orders.php` ไปที่ WordPress plugins directory:
   ```
   /path/to/wordpress/wp-content/plugins/yardsale-orders/yardsale-orders.php
   ```

2. Activate plugin ใน WordPress Admin:
   - ไปที่ Plugins > Installed Plugins
   - คลิก "Activate" ที่ "Yardsale Orders API"

### 2. ตรวจสอบ JWT Authentication Plugin

ให้แน่ใจว่า JWT Authentication plugin ถูกติดตั้งและ activate แล้ว:
- Plugin: JWT Authentication for WP REST API
- Endpoint: `/wp-json/jwt-auth/v1/token`

### 3. การใช้งาน

#### Frontend (my-orders.vue)

Frontend จะใช้ JWT token ที่ได้จาก login:

```typescript
// JWT token ถูกเก็บใน user.value.token หลังจาก login
const jwtToken = user.value.token;

// เรียก API ด้วย JWT token
const ordersData = await $fetch('/api/my-orders-jwt', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

#### API Endpoint

**GET `/api/my-orders-jwt`**

Headers:
- `Authorization: Bearer {JWT_TOKEN}` (required)

Query Parameters:
- `per_page` (optional, default: 100)
- `page` (optional, default: 1)
- `status` (optional, filter by order status)

Response:
```json
{
  "orders": [...],
  "count": 10,
  "success": true
}
```

#### WordPress Custom Endpoint

**GET `/wp-json/yardsale/v1/my-orders`**

Headers:
- `Authorization: Bearer {JWT_TOKEN}` (required)

Query Parameters:
- `per_page` (optional, default: 100)
- `page` (optional, default: 1)
- `status` (optional, filter by order status)

## Flow

1. User login → ได้ JWT token
2. Frontend เรียก `/api/my-orders-jwt` พร้อม JWT token ใน Authorization header
3. Nuxt API route ส่ง JWT token ไปยัง PHP script
4. PHP script เรียก WordPress custom endpoint `/wp-json/yardsale/v1/my-orders` พร้อม JWT token
5. WordPress plugin validate JWT token และดึง orders ของ user นั้นเท่านั้น
6. Return orders กลับไปยัง frontend

## Security

- JWT token ถูก validate ใน WordPress plugin
- User จะเห็นเฉพาะ orders ของตัวเองเท่านั้น
- ไม่ต้องส่ง customer_id หรือ email เพราะ user ID มาจาก JWT token

## Troubleshooting

### Error: "Authorization header is required"
- ตรวจสอบว่า JWT token ถูกส่งใน Authorization header
- ตรวจสอบว่า user มี token หลังจาก login

### Error: "Invalid or expired JWT token"
- JWT token อาจหมดอายุ ให้ login ใหม่
- ตรวจสอบว่า JWT Authentication plugin ทำงานถูกต้อง

### Error: "WooCommerce is not installed"
- ตรวจสอบว่า WooCommerce plugin ถูกติดตั้งและ activate แล้ว
