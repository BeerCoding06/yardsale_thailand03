# PayPal capture → WooCommerce order status (REST API)

หลัง PayPal capture สำเร็จ `POST /api/paypal-capture-order` จะอัปเดตออเดอร์แบบนี้:

1. **ลำดับแรก:** `PUT /wp-json/wc/v3/orders/{id}` พร้อม `{ "set_paid": true }` (ทางเลือก: `"transaction_id": "..."`)  
   - **ห้าม**ส่ง `"status":"processing"` พร้อม `set_paid` ใน request เดียว — WooCommerce จะบันทึกสถานะ processing ก่อน ทำให้ข้าม `payment_complete()` และ **ไม่ลดสต็อก**  
   - ต้องมี **`WP_CONSUMER_KEY`** + **`WP_CONSUMER_SECRET`** บน Nuxt (สิทธิ์ **Read/Write**)
   - Auth: **HTTP Basic** — `Authorization: Basic base64(consumer_key:consumer_secret)`
2. **ถ้า REST ล้มเหลว** และมี **`ORDER_PAID_SECRET`:** เรียก `POST /wp-json/yardsale/v1/order-paid` (plugin) แทน
3. **ถ้าไม่มีทั้งคู่:** คืน `woocommerce_updated: false` + warning

Implementation: `server/utils/woocommerce-order.ts` + `server/api/paypal-capture-order.post.ts`

---

## ตัวอย่าง `curl` (ทดสอบมือ)

แทนที่โดเมน, เลขออเดอร์, และ key/secret:

```bash
SITE="https://cms.example.com"
ORDER_ID=1234
CK="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
CS="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

curl -sS -X PUT "${SITE}/wp-json/wc/v3/orders/${ORDER_ID}" \
  -u "${CK}:${CS}" \
  -H "Content-Type: application/json" \
  -d '{"set_paid":true}' \
  -w "\nHTTP %{http_code}\n"
```

- **200** + JSON ออเดอร์ = สำเร็จ  
- **401** = key/secret ผิด หรือไม่ใช่ HTTPS (บางการตั้งค่า)  
- **403** = key เป็น **Read** อย่างเดียว — สร้าง key ใหม่แบบ **Read/Write**  
- **404** = ไม่มีออเดอร์นั้น หรือ URL ผิด  

ทางเลือก (query string — เหมาะกับ HTTP บางรุ่น; **แนะนำ HTTPS + Basic**):

```bash
curl -sS -X PUT "${SITE}/wp-json/wc/v3/orders/${ORDER_ID}?consumer_key=${CK}&consumer_secret=${CS}" \
  -H "Content-Type: application/json" \
  -d '{"set_paid":true}'
```

---

## Debugging checklist

| ตรวจ | รายละเอียด |
|------|-------------|
| `WP_BASE_URL` | ชี้โดเมน WooCommerce จริง (ไม่มี slash ท้าย) |
| Keys บน Nuxt | `WP_CONSUMER_KEY` / `WP_CONSUMER_SECRET` หรือค่าใน `nuxt.config` `runtimeConfig` |
| สิทธิ์ key | WooCommerce → Settings → Advanced → REST API → **Read/Write** |
| HTTPS | เว็บใช้ HTTPS แล้ว — Basic Auth กับ WC มาตรฐาน |
| Order ID | เป็นหมายเลขออเดอร์ WC จริง (ไม่ใช่ PayPal id) |
| REST เปิด | ไม่มีปลั๊กอิน / firewall บล็อก `/wp-json/wc/v3/*` |
| Log Nuxt | `[woocommerce-order] PUT wc/v3/orders failed` จะมี **full body** จาก WooCommerce |
| Fallback | ตั้ง `ORDER_PAID_SECRET` ไว้เสมอถ้าต้องการ `yardsale_order_paid` เมื่อ REST พัง |

---

## Environment (สรุป)

```env
WP_BASE_URL=https://your-site.com
WP_CONSUMER_KEY=ck_...
WP_CONSUMER_SECRET=cs_...
# สำรองเมื่อ PUT ล้มเหลว
ORDER_PAID_SECRET=...
```

Restart Nuxt หลังแก้ env.
