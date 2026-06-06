# 17TRACK Package Webhook (V2.4)

Configure in [17TRACK API dashboard](https://api.17track.net/admin/settings):

| Setting | Value |
|---------|--------|
| **Webhook URL** | `https://api.yardsaleth.com/api/webhooks/17track` |
| **Version** | V2.4 |

### Trigger statuses (เลือกทั้งหมด)

- Not found / ไม่พบ
- Info received / รับข้อมูลแล้ว
- In transit / กำลังขนส่ง
- Expired / หมดอายุ
- Available for pickup / รับของ
- Out for delivery / กำลังจัดส่ง
- Delivery failed / ไม่มีการจัดส่ง

When 17TRACK pushes `TRACKING_UPDATED`, the backend:

1. Verifies header `sign` = SHA256(`rawBody + "/" + SEVENTEEN_TRACK_API_KEY`)
2. Finds paid orders with matching `tracking_number`
3. Updates `shipping_status`, `courier_name` (if empty), `fulfillment_updated_at`
4. Sets `delivered_at` when status maps to delivered
5. Appends row to `tracking_logs`

**Test:** Dashboard → WebHook test → paste URL → Test (expects HTTP 200).

**Health:** `GET https://api.yardsaleth.com/api/webhooks/17track` → `{ "success": true, "data": { "ok": true } }`

**Note:** Thailand Post barcodes use the official API via `POST /api/track`, not this webhook. Register non–Thailand Post numbers via 17TRACK (happens automatically on first `/api/track` or seller fulfillment save).

---

# Shipment tracking API

## Flow

`Frontend → POST /api/track → Backend → Thailand Post API **or** 17TRACK → normalized JSON + optional row in tracking_logs`

| Carrier | Provider |
|---------|----------|
| **Thailand Post** (barcode `^[A-Z]{2}\d{9}TH$`) | Official Thailand Post Track&Trace API |
| **All other carriers** (Flash, J&T, Kerry, DHL, FedEx, …) | 17TRACK v2.4 |

**Seller fulfillment:** `PATCH /api/seller-orders/:orderId/fulfillment` with `tracking_number` (and optional `shipping_receipt_number`, `courier_name`). The client does not send `shipping_status`. The backend routes by barcode pattern + `courier_name`, maps the result to `shipping_status` (`pending` … `delivered`), and fills `courier_name` when the seller left it blank. If lookup fails, `shipping_status` is set to `shipped` when a non-empty tracking number is saved. Clearing `tracking_number` resets `shipping_status` to `pending`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `THAILAND_POST_API_KEY` or `THAILAND_POST_API_KEY_B64` | Yes (ไปรษณีย์ไทย) | API key from [Thailand Post dashboard](https://track.thailandpost.co.th/dashboard). Prefer `_B64` in Docker if key contains `$`. |
| `SEVENTEEN_TRACK_API_KEY` | Yes (ทุกขนส่งอื่น) | 17TRACK key for Flash / J&T / Kerry / DHL / FedEx / etc. |
| `SEVENTEEN_TRACK_BASE_URL` | No | Default `https://api.17track.net` |
| `TRACK_API_RATE_LIMIT_PER_MINUTE` | No | Default `30` per client IP on `/api/track` |

Run DB migration / `schema` so table `tracking_logs` exists.

## 17TRACK carrier hints (optional)

When auto-detect fails, pass `courierName` or `carrier` (17TRACK key):

| Carrier | 17TRACK key |
|---------|-------------|
| Flash Express (TH) | `100235` |
| Kerry Express (TH) | `100236` |
| J&T Express (TH) | `100271` |
| DHL Express | `100001` |
| FedEx | `100003` |

## Thailand Post status codes (mapping)

| Code | Stage | → `shipping_status` |
|------|-------|----------------------|
| 101–103 | รับเข้าระบบ / รับฝาก | `preparing` |
| 201–207 | ระหว่างขนส่ง | `shipped` |
| 301–302 | ออกไปนำจ่าย | `out_for_delivery` |
| 501 (+ delivery_status `S`) | นำจ่ายสำเร็จ | `delivered` |

## Request

`POST /api/track`

```json
{
  "trackingNumber": "TH0123456789012",
  "courierName": "Flash Express"
}
```

- `trackingNumber` (required): tracking / consignment number.
- `courierName` (optional): helps 17TRACK pick the right carrier when auto-detect is ambiguous.
- `carrier` (optional): 17TRACK carrier key (see table above).
- `language` (optional): `TH` or `EN` for Thailand Post responses only.

## Example success response

```json
{
  "success": true,
  "data": {
    "trackingNumber": "EQ191963463TH",
    "carrier": "Thailand Post",
    "carrierCode": null,
    "provider": "thailand_post",
    "currentStatus": "นำจ่ายสำเร็จ",
    "updatedAt": "2026-05-30T04:59:00.000Z",
    "trackingHistory": []
  }
}
```

Provider values: `thailand_post`, `17track`.

## Error handling strategy

| Situation | HTTP | `error.code` (typical) |
|-----------|------|------------------------|
| Validation (missing/invalid `trackingNumber`) | 400 | Joi / validation layer |
| No tracking provider configured | 503 | `TRACKING_NOT_CONFIGURED` |
| 17TRACK lookup failure | 502 | `TRACKING_LOOKUP_FAILED` |
| Upstream auth / invalid key | 502 | `TRACKING_UPSTREAM_AUTH` |
| Rate limit | 429 | `TRACKING_UPSTREAM_RATE_LIMIT` |
| Number not found | 404 | `TRACKING_NOT_FOUND` |

## Database (`tracking_logs`)

Audit log per lookup:

- `tracking_number`, `carrier`, `status`, `raw_response`, `created_at`.
