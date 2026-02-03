# JWT Authentication Flow สำหรับ Orders API

## 🔄 Flow Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. POST /api/login
       │    { username, password }
       ▼
┌─────────────────────┐
│  Nuxt API Route     │
│  /api/login         │
└──────┬──────────────┘
       │
       │ 2. Call PHP script
       ▼
┌─────────────────────┐
│  login.php          │
│  - Call JWT endpoint│
│  - Get JWT token    │
│  - Return user+token│
└──────┬──────────────┘
       │
       │ 3. Response: { success: true, user: { id, token, ... } }
       ▼
┌─────────────┐
│   User      │
│  (Browser)  │
│  - Store   │
│    user in │
│    localStorage│
└──────┬──────┘
       │
       │ 4. GET /api/my-orders-jwt
       │    Header: Authorization: Bearer {token}
       ▼
┌─────────────────────┐
│  Nuxt API Route     │
│  /api/my-orders-jwt │
│  - Extract token    │
│  - Call PHP script  │
└──────┬──────────────┘
       │
       │ 5. Call PHP with token
       ▼
┌─────────────────────┐
│  getMyOrders.php    │
│  - Get token from   │
│    Authorization    │
│  - Call WordPress   │
│    custom endpoint  │
└──────┬──────────────┘
       │
       │ 6. GET /wp-json/yardsale/v1/my-orders
       │    Header: Authorization: Bearer {token}
       ▼
┌─────────────────────┐
│  WordPress Plugin   │
│  yardsale-orders    │
│  - Validate JWT     │
│  - Get user ID      │
│  - Get orders       │
└──────┬──────────────┘
       │
       │ 7. Response: { orders: [...], count: N }
       ▼
┌─────────────┐
│   User      │
│  (Browser)  │
│  - Display  │
│    orders   │
└─────────────┘
```

## 📋 Step-by-Step Implementation

### Step 1: JWT Login

**Endpoint:** `POST /api/login`

**Request:**
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

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

**Implementation:**
- `server/api/php/login.php` เรียก `/wp-json/jwt-auth/v1/token`
- ได้ JWT token กลับมา
- ส่ง token กลับไปใน `user.token`

### Step 2: Store Token

**Frontend:**
- `app/composables/useAuth.ts` เก็บ user (รวม token) ใน localStorage
- `user.value.token` มี JWT token

### Step 3: Get Orders with JWT Token

**Endpoint:** `GET /api/my-orders-jwt`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Flow:**
1. Frontend เรียก `/api/my-orders-jwt` พร้อม Authorization header
2. Nuxt API route (`server/api/my-orders-jwt.get.ts`) รับ token
3. ส่ง token ไปยัง PHP script (`server/api/php/getMyOrders.php`)
4. PHP script เรียก WordPress custom endpoint

### Step 4: WordPress Custom Endpoint

**Endpoint:** `GET /wp-json/yardsale/v1/my-orders`

**Headers:**
```
Authorization: Bearer {JWT_TOKEN}
```

**Flow:**
1. WordPress plugin (`wordpress-plugin-yardsale-orders.php`) รับ request
2. `yardsale_jwt_auth_check()` validate JWT token
3. Extract user ID จาก token
4. `yardsale_get_my_orders()` ดึง orders ของ user นั้นเท่านั้น
5. Return orders

## ✅ Checklist

- [x] JWT login endpoint (`/api/login`)
- [x] Token storage in localStorage
- [x] Frontend calls `/api/my-orders-jwt` with token
- [x] Nuxt API route extracts token
- [x] PHP script calls WordPress endpoint
- [x] WordPress plugin validates JWT
- [x] WordPress plugin gets user orders
- [x] Response returns to frontend

## 🔍 Debug Points

1. **Login:** ตรวจสอบว่า token ถูกส่งกลับมาใน response
2. **Storage:** ตรวจสอบว่า token ถูกเก็บใน localStorage
3. **API Call:** ตรวจสอบว่า Authorization header ถูกส่งไป
4. **WordPress:** ตรวจสอบว่า plugin validate token สำเร็จ
5. **Orders:** ตรวจสอบว่า orders ถูก filter โดย user ID

## 🐛 Troubleshooting

### Token ไม่ถูกเก็บ
- ตรวจสอบ `login.php` ส่ง token กลับมาหรือไม่
- ตรวจสอบ `useAuth.ts` เก็บ user object ถูกต้องหรือไม่

### Token ไม่ถูกส่ง
- ตรวจสอบ Authorization header ใน Network tab
- ตรวจสอบ `my-orders-jwt.get.ts` รับ header ถูกต้องหรือไม่

### WordPress ไม่รับ token
- ตรวจสอบ WordPress debug log
- ตรวจสอบ plugin activate แล้วหรือไม่
- ตรวจสอบ JWT Authentication plugin ทำงานหรือไม่
