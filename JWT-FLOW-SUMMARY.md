# JWT Authentication Flow - สรุป

## ✅ Flow ที่ทำงานแล้ว

### Step 1: JWT Login
**Endpoint:** `POST /api/login`

**Flow:**
1. User ส่ง username/password
2. `login.php` เรียก `/wp-json/jwt-auth/v1/token`
3. ได้ JWT token กลับมา
4. ส่ง token กลับไปใน `user.token`

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
  }
}
```

### Step 2: Store Token
**Frontend:** `app/composables/useAuth.ts`
- เก็บ user object (รวม token) ใน localStorage
- `user.value.token` มี JWT token

### Step 3: Get Orders
**Endpoint:** `GET /api/my-orders-jwt`

**Flow:**
1. Frontend เรียก `/api/my-orders-jwt` พร้อม `Authorization: Bearer {token}`
2. Nuxt API route (`server/api/my-orders-jwt.get.ts`) รับ token
3. ส่ง token ไปยัง PHP script (`server/api/php/getMyOrders.php`)
4. PHP script เรียก WordPress custom endpoint `/wp-json/yardsale/v1/my-orders`

### Step 4: WordPress Custom Endpoint
**Endpoint:** `GET /wp-json/yardsale/v1/my-orders`

**Flow:**
1. WordPress plugin (`wordpress-plugin-yardsale-orders.php`) รับ request
2. `yardsale_jwt_auth_check()` validate JWT token
3. Extract user ID จาก token
4. `yardsale_get_my_orders()` ดึง orders ของ user นั้นเท่านั้น
5. Return orders

**Response:**
```json
{
  "orders": [
    {
      "id": 123,
      "number": "123",
      "status": "completed",
      "date_created": "2026-02-03 10:00:00",
      "total": "500.00",
      "line_items": [...]
    }
  ],
  "count": 1,
  "success": true
}
```

## 🔍 Debug Logging

### Frontend (Browser Console)
- `[my-orders] User:` - แสดง user object
- `[my-orders] JWT Token:` - แสดง token (first 20 chars)
- `[my-orders] Calling /api/my-orders-jwt with JWT token`
- `[my-orders] Orders API response:` - แสดง response

### Nuxt API (Server Logs)
- `[my-orders-jwt] Executing PHP script: getMyOrders.php`
- `[my-orders-jwt] JWT Token (first 20 chars):`
- `[my-orders-jwt] PHP script response:`

### PHP Script (Server Logs)
- `[getMyOrders] JWT token received (length: ...)`
- `[getMyOrders] JWT token (first 50 chars):`
- `[getMyOrders] Calling WordPress custom endpoint:`

### WordPress Plugin (WordPress Debug Log)
- `[yardsale_jwt_auth_check] Authorization header check:`
- `[yardsale_jwt_auth_check] Final auth_header:`

## 🧪 การทดสอบ

### 1. ทดสอบ Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"password123"}'
```

### 2. ทดสอบ Get Orders (ใช้ token จาก login)
```bash
curl -X GET http://localhost:3000/api/my-orders-jwt \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

### 3. ทดสอบ WordPress Endpoint โดยตรง
```bash
curl -X GET http://157.85.98.150:8080/wp-json/yardsale/v1/my-orders \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

## ✅ Checklist

- [x] JWT login endpoint (`/api/login`) - ได้ token
- [x] Token storage in localStorage - เก็บ token
- [x] Frontend calls `/api/my-orders-jwt` with token - ส่ง token
- [x] Nuxt API route extracts token - รับ token
- [x] PHP script calls WordPress endpoint - เรียก WordPress
- [x] WordPress plugin validates JWT - validate token
- [x] WordPress plugin gets user orders - ดึง orders
- [x] Response returns to frontend - ส่งกลับ

## 🎯 สรุป

Flow ทั้งหมดทำงานแล้ว:
1. ✅ JWT login → ได้ token
2. ✅ WordPress custom endpoint → validate token
3. ✅ ดึง order ของ user นั้นเท่านั้น

ระบบพร้อมใช้งานแล้ว! 🎉
