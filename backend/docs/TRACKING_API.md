# Shipment tracking API (Thailand Post + 17TRACK)

## Flow

`Frontend → POST /api/track → Backend → Thailand Post REST API (TH barcodes) **or** 17TRACK v2.4 → normalized JSON + optional row in tracking_logs`

**Priority:** Barcodes matching Thailand Post format (`^[A-Z]{2}\d{9}TH$`, e.g. `EQ191963463TH`) use the **official Thailand Post Track&Trace API** when `THAILAND_POST_API_KEY` is set. Other carriers fall back to 17TRACK when `SEVENTEEN_TRACK_API_KEY` is set.

**Seller fulfillment:** `PATCH /api/seller-orders/:orderId/fulfillment` with `tracking_number` (and optional `shipping_receipt_number`, `courier_name`). The client does not send `shipping_status`. The backend calls Thailand Post (or 17TRACK) when configured, maps the result to `shipping_status` (`pending` … `delivered`), and fills `courier_name` when the seller left it blank. If no provider is configured or lookup fails, `shipping_status` is set to `shipped` when a non-empty tracking number is saved. Clearing `tracking_number` resets `shipping_status` to `pending`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `THAILAND_POST_API_KEY` | Yes (EMS / ไปรษณีย์ไทย) | API key from [Thailand Post dashboard](https://track.thailandpost.co.th/dashboard) |
| `SEVENTEEN_TRACK_API_KEY` | Optional | 17TRACK key for Kerry / Flash / other carriers |
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

## Request

`POST /api/track`

```json
{
  "trackingNumber": "EQ191963463TH",
  "language": "TH"
}
```

- `trackingNumber` (required): tracking / consignment number.
- `carrier` (optional): 17TRACK carrier key when auto-detect fails (non-TH barcodes).
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

## Error handling strategy

| Situation | HTTP | `error.code` (typical) |
|-----------|------|------------------------|
| Validation (missing/invalid `trackingNumber`) | 400 | Joi / validation layer |
| No tracking provider configured | 503 | `TRACKING_NOT_CONFIGURED` |
| Upstream auth / invalid key | 502 | `TRACKING_UPSTREAM_AUTH` |
| Rate limit | 429 | `TRACKING_UPSTREAM_RATE_LIMIT` |
| Number not found | 404 | `TRACKING_NOT_FOUND` |

## Database (`tracking_logs`)

Same as before — audit log per lookup:

- `tracking_number`, `carrier` (resolved display name), `status` (current text), `raw_response` (full JSON from upstream), `created_at`.
