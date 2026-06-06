# Shipment tracking API

## Flow

`Frontend → POST /api/track → Backend → provider by courier → normalized JSON + optional row in tracking_logs`

| Carrier | Provider |
|---------|----------|
| **Thailand Post** (barcode `^[A-Z]{2}\d{9}TH$`) | Official Thailand Post Track&Trace API |
| **Flash Express** | Website scraping |
| **J&T Express** | Website scraping |
| **Kerry Express** | Website scraping |
| **DHL / FedEx** | 17TRACK v2.4 |

**Seller fulfillment:** `PATCH /api/seller-orders/:orderId/fulfillment` with `tracking_number` (and optional `shipping_receipt_number`, `courier_name`). The client does not send `shipping_status`. The backend routes by barcode pattern + `courier_name`, maps the result to `shipping_status` (`pending` … `delivered`), and fills `courier_name` when the seller left it blank. If lookup fails, `shipping_status` is set to `shipped` when a non-empty tracking number is saved. Clearing `tracking_number` resets `shipping_status` to `pending`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `THAILAND_POST_API_KEY` or `THAILAND_POST_API_KEY_B64` | Yes (ไปรษณีย์ไทย) | API key from [Thailand Post dashboard](https://track.thailandpost.co.th/dashboard). Prefer `_B64` in Docker if key contains `$`. |
| `SEVENTEEN_TRACK_API_KEY` | Yes (DHL / FedEx only) | 17TRACK key — not used for Flash / J&T / Kerry |
| `SEVENTEEN_TRACK_BASE_URL` | No | Default `https://api.17track.net` |
| `TRACK_API_RATE_LIMIT_PER_MINUTE` | No | Default `30` per client IP on `/api/track` |

Run DB migration / `schema` so table `tracking_logs` exists.

## Thailand Post status codes (mapping)

| Code | Stage | → `shipping_status` |
|------|-------|----------------------|
| 101–103 | รับเข้าระบบ / รับฝาก | `preparing` |
| 201–207 | ระหว่างขนส่ง | `shipped` |
| 301–302 | ออกไปนำจ่าย | `out_for_delivery` |
| 501 (+ delivery_status `S`) | นำจ่ายสำเร็จ | `delivered` |

Scraped carriers (Flash / J&T / Kerry) use keyword matching on status text (Thai + English).

## Request

`POST /api/track`

```json
{
  "trackingNumber": "EQ191963463TH",
  "language": "TH",
  "courierName": "Flash Express"
}
```

- `trackingNumber` (required): tracking / consignment number.
- `courierName` (optional): seller-selected courier — helps route Flash / J&T / Kerry / DHL / FedEx when barcode alone is ambiguous.
- `carrier` (optional): 17TRACK carrier key (`100001` = DHL, `100003` = FedEx) when auto-detect fails.
- `language` (optional): `TH` or `EN` for Thailand Post responses.

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
    "trackingHistory": [
      {
        "time": "2026-05-30T04:59:00.000Z",
        "status": "นำจ่ายสำเร็จ",
        "location": "ที่ทำการไปรษณีย์ บางเสาธง",
        "stage": "501"
      }
    ]
  }
}
```

(`trackingHistory` is newest-first.)

Provider values: `thailand_post`, `scrape_flash`, `scrape_jt`, `scrape_kerry`, `17track`.

## Error handling strategy

| Situation | HTTP | `error.code` (typical) |
|-----------|------|------------------------|
| Validation (missing/invalid `trackingNumber`) | 400 | Joi / validation layer |
| Unknown / unsupported courier | 400 | `TRACKING_UNSUPPORTED_COURIER` |
| No tracking provider configured | 503 | `TRACKING_NOT_CONFIGURED` |
| Scrape / upstream failure | 502 | `TRACKING_SCRAPE_FAILED` / `TRACKING_LOOKUP_FAILED` |
| Upstream auth / invalid key | 502 | `TRACKING_UPSTREAM_AUTH` |
| Rate limit | 429 | `TRACKING_UPSTREAM_RATE_LIMIT` |
| Number not found | 404 | `TRACKING_NOT_FOUND` |

## Database (`tracking_logs`)

Audit log per lookup:

- `tracking_number`, `carrier` (resolved display name), `status` (current text), `raw_response` (full JSON from upstream), `created_at`.
