# Security – ป้องกันการ inject และมัลแวร์

## นโยบายโปรเจกต์

- **ห้ามใช้** `eval()`, `assert()`, `create_function()`, `preg_replace(..., '/e')` หรือการ include/require ที่ path มาจาก user โดยตรง
- **ห้าม** รันโค้ดจาก string ที่ decode จาก base64/gzinflate ถ้าไม่ใช่ข้อมูลอย่างเดียว (เช่น JWT payload ใช้แค่ json_decode อ่านค่า ไม่ส่งไป eval)
- Input ทุกจุดที่มาจาก `$_GET`, `$_POST`, `$_REQUEST` ต้อง **validate / whitelist / sanitize** ก่อนใช้

## สิ่งที่ทำแล้วใน repo นี้

### WordPress Plugin (`wordpress-plugin-yardsale-orders.php`)

- ไม่มี `eval` / `assert` / `create_function`
- JWT: decode แค่ `base64_decode(..., true)` + `json_decode` แล้วใช้ payload เป็นข้อมูลเท่านั้น (เช่น email, user id) ไม่ส่งไป execute
- รับ request ผ่าน REST API ของ WordPress; ใช้ capability/permission callback

### PHP scripts ใน `server/api/php/`

- **getCategories.php**: `orderby` ใช้ whitelist เท่านั้น; `order` รับแค่ `asc`/`desc`
- **getProducts.php**: `orderby` map จาก whitelist; `order` รับแค่ `asc`/`desc`; `search`/`category` จำกัดความยาว
- **getProduct.php**: `slug`/`sku` sanitize ด้วย `preg_replace` ให้เหลือเฉพาะตัวอักษร/ตัวเลข/ขีด
- **searchProducts.php**: จำกัดความยาว `search` และช่วงค่า `limit`
- **getOrders.php** / **getMyOrders.php**: `status` ใช้ whitelist; `customer_id` cast เป็น int; จำกัดความยาว `customer_email`
- **login.php**: `require_once` ใช้ path แบบ hardcode (`/var/www/html/wp-load.php`) ไม่มาจาก input

### config.php

- `base64_decode(WP_BASIC_AUTH)` ใช้ decode credential จาก env เท่านั้น ไม่ส่งไป eval/exec

## แนะนำบนเซิร์ฟเวอร์ (WordPress / PHP)

1. **disable_functions** (ใน php.ini): เพิ่ม `eval,assert,create_function,shell_exec,passthru,system,exec` ถ้าโฮสต์อนุญาต
2. ตรวจสอบ plugin/themes อื่นใน WordPress ว่ามีไฟล์ที่ถูกแก้โดยไม่รู้ตัวหรือมีโค้ดแปลกปลอม (รวมถึงไฟล์ที่มี `eval(`, `base64_decode(` แล้วส่งไป `eval`)
3. อัปเดต WordPress, PHP, และ plugin ให้เป็นเวอร์ชันที่ยังได้รับการแก้ไขความปลอดภัย
4. ตั้งค่าไฟล์ใน `wp-content`: ไม่ควรให้ web server เขียนได้ทุกที่ ถ้าจำเป็นให้จำกัดเฉพาะโฟลเดอร์ที่ต้องใช้ (เช่น uploads)

## ถ้าพบโค้ดแปลกปลอม

- สแกนหา: `eval(`, `assert(`, `base64_decode(` คู่กับ `eval`, `gzinflate`, `str_rot13`, `create_function`
- ตรวจไฟล์ที่แก้ล่าสุด: `find . -name "*.php" -mtime -7`
- เปลี่ยนรหัสผ่าน DB, รหัสแอป (WooCommerce REST API, JWT secret) หลังลบมัลแวร์แล้ว
