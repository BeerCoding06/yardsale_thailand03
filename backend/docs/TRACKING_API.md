# Shipment tracking API (17TRACK)

## Flow

`Frontend → POST /api/track → Backend → 17TRACK v2.4 (register + gettrackinfo) → normalized JSON + optional row in tracking_logs`

**Seller fulfillment:** `PATCH /api/seller-orders/:orderId/fulfillment` with `{ "tracking_number": "..." }` only. The backend calls 17TRACK (when `SEVENTEEN_TRACK_API_KEY` is set), maps the result to `shipping_status` (`pending` … `delivered`) and sets `courier_name` from the carrier. If the key is missing or lookup fails, `shipping_status` is set to `shipped` when a non-empty tracking number is saved.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SEVENTEEN_TRACK_API_KEY` | Yes (prod) | API key from [17TRACK](https://api.17track.net) (header `17token`) |
| `SEVENTEEN_TRACK_BASE_URL` | No | Default `https://api.17track.net` |
| `TRACK_API_RATE_LIMIT_PER_MINUTE` | No | Default `30` per client IP on `/api/track` |

Run DB migration / `schema` so table `tracking_logs` exists.

## Request

`POST /api/track`

```json
{
  "trackingNumber": "RA123456789TH",
  "carrier": 1001
}
```

- `trackingNumber` (required): tracking / consignment number.
- `carrier` (optional): 17TRACK carrier key if auto-detect fails.

## Example success response

```json
{
  "success": true,
  "data": {
    "trackingNumber": "RA123456789TH",
    "carrier": "Thailand Post",
    "carrierCode": 1001,
    "currentStatus": "In transit",
    "updatedAt": "2025-04-09T08:15:00.000Z",
    "trackingHistory": [
      {
        "time": "2025-04-09T08:15:00.000Z",
        "status": "Departed facility",
        "location": "Bangkok",
        "stage": ""
      }
    ]
  }
}
```

(Field names mirror 17TRACK payloads where possible; `trackingHistory` is newest-first when times are present.)

## Error handling strategy

| Situation | HTTP | `error.code` (typical) |
|-----------|------|-------------------------|
| Validation (missing/invalid `trackingNumber`) | 400 | Joi / validation layer |
| Too many requests (our rate limit) | 429 | `TRACK_API_RATE_LIMIT` |
| Missing API key on server | 503 | `TRACKING_NOT_CONFIGURED` |
| 17TRACK HTTP 401 | 502 | `TRACKING_UPSTREAM_AUTH` |
| 17TRACK HTTP 429 (with retries) | 429 | `TRACKING_UPSTREAM_RATE_LIMIT` |
| 17TRACK business error (e.g. no data yet) | 404 / 502 | `TRACKING_GETINFO_FAILED` / `TRACKING_NOT_FOUND` |
| Malformed upstream JSON | 502 | `TRACKING_UPSTREAM_INVALID` |

Production responses mask 500 details (see `middlewares/errorHandler.js`).

## Rate limits

1. **Our API:** `trackRateLimit` middleware (~30 req/min/IP by default). Tune with `TRACK_API_RATE_LIMIT_PER_MINUTE`.
2. **17TRACK:** Account limits apply (documented as ~**3 requests/second**). The service retries with backoff on HTTP **429** from 17TRACK.

## Database (`tracking_logs`)

Each successful lookup stores:

- `tracking_number`, `carrier` (resolved display name), `status` (current text), `raw_response` (full JSON from `gettrackinfo`), `created_at`.

Use for support, auditing, and debugging — **do not** expose `raw_response` to the browser.

## References

- [17TRACK API v2.4](https://api.17track.net/en/doc?version=v2.4)
- [Error codes (help center)](https://help.17track.net/hc/en-us/articles/37570440168473-Error-Codes-and-Troubleshooting)
