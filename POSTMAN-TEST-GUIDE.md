# คู่มือการทดสอบ Endpoint ใน Postman

## ทดสอบ: `/wp-json/yardsale/v1/my-orders`

### 1. ตั้งค่า Request

**Method:** `GET`

**URL:**
```
http://157.85.98.150:8080/wp-json/yardsale/v1/my-orders
```

### 2. ตั้งค่า Headers

ไปที่แท็บ **Headers** และเพิ่ม:

| Key | Value |
|-----|-------|
| `Authorization` | `Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vMTU3Ljg1Ljk4LjE1MDo4MDgwIiwiaWF0IjoxNzcwMTMyMzc4LCJuYmYiOjE3NzAxMzIzNzgsImV4cCI6MTc3MDczNzE3OCwiZGF0YSI6eyJ1c2VyIjp7ImlkIjoiMSJ9fX0.stPtm81C4IqcQ7QP0vUbEro_JSOpym5ORrwI9b9XGnw` |

**สำคัญ:** 
- Key ต้องเป็น `Authorization` (ตัวใหญ่ A)
- Value ต้องเริ่มด้วย `Bearer ` (มี space หลัง Bearer)

### 3. ตั้งค่า Query Parameters (Optional)

ไปที่แท็บ **Params** และเพิ่ม:

| Key | Value |
|-----|-------|
| `per_page` | `100` |
| `page` | `1` |
| `status` | (optional) |

### 4. ส่ง Request

คลิก **Send**

### 5. ตรวจสอบ Response

**ถ้าสำเร็จ (200 OK):**
```json
{
    "orders": [...],
    "count": 10,
    "success": true
}
```

**ถ้า Error (401 Unauthorized):**
```json
{
    "code": "missing_authorization",
    "message": "Authorization header is required",
    "data": {
        "status": 401
    }
}
```

## Troubleshooting

### Error: "Authorization header is required"

**สาเหตุที่เป็นไปได้:**
1. Header ไม่ได้ถูกส่งไป
2. ชื่อ header ไม่ถูกต้อง
3. WordPress ไม่สามารถอ่าน header ได้

**วิธีแก้:**
1. ตรวจสอบว่า Header ถูกเพิ่มใน Postman แล้ว
2. ตรวจสอบว่า Key เป็น `Authorization` (ไม่ใช่ `authorization`)
3. ตรวจสอบว่า Value เริ่มด้วย `Bearer ` (มี space)
4. ลองใช้ `X-Authorization` header แทน (ถ้า WordPress รองรับ)

### Error: "Invalid or expired JWT token"

**สาเหตุ:**
- JWT token หมดอายุหรือไม่ถูกต้อง

**วิธีแก้:**
- Login ใหม่เพื่อได้ JWT token ใหม่

### Error: "User not authenticated"

**สาเหตุ:**
- JWT token ไม่สามารถ validate ได้

**วิธีแก้:**
- ตรวจสอบว่า JWT Authentication plugin ถูก activate แล้ว
- ตรวจสอบว่า JWT token ถูกต้อง

## ตัวอย่าง Postman Collection

สร้าง Collection ใหม่ใน Postman:

```json
{
    "info": {
        "name": "Yardsale API",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "item": [
        {
            "name": "Get My Orders",
            "request": {
                "method": "GET",
                "header": [
                    {
                        "key": "Authorization",
                        "value": "Bearer {{jwt_token}}",
                        "type": "text"
                    }
                ],
                "url": {
                    "raw": "http://157.85.98.150:8080/wp-json/yardsale/v1/my-orders?per_page=100",
                    "protocol": "http",
                    "host": ["157.85.98.150"],
                    "port": "8080",
                    "path": ["wp-json", "yardsale", "v1", "my-orders"],
                    "query": [
                        {
                            "key": "per_page",
                            "value": "100"
                        }
                    ]
                }
            }
        }
    ]
}
```

## ตั้งค่า Environment Variable

1. สร้าง Environment ใหม่ใน Postman
2. เพิ่ม variable:
   - `jwt_token`: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`
3. ใช้ `{{jwt_token}}` ใน Authorization header
