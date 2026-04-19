# Seller wallet & escrow

Funds from paid orders are credited per seller into **escrow**. When delivery is confirmed (tracking shows `delivered` **or** the buyer confirms receipt), balances move to **available** so sellers can withdraw.

## Database

Apply migrations `20260417_seller_wallet_system.sql`, `20260418_withdrawals_payout_bank.sql`, `20260419_withdrawals_fee.sql` (หรือรัน `db/schema.sql` ที่อัปเดตแล้ว).

Tables: `seller_wallets`, `wallet_transactions`, `withdrawals`, `financial_audit_logs`; columns on `orders`: `buyer_confirmed_delivery_at`, `funds_settled_at`.  
ตาราง `withdrawals`: รวม `payout_*`, `withdrawal_fee_amount`, `net_payout_amount`.

## Seller

### `GET /api/wallet`

```json
{
  "success": true,
  "data": {
    "success": true,
    "wallet": {
      "seller_id": "uuid",
      "available_balance": 120.5,
      "escrow_balance": 30,
      "updated_at": "2026-04-17T12:00:00.000Z"
    },
    "transactions": [],
    "withdrawal_policy": {
      "fee_percent": 5,
      "fee_rate": 0.05,
      "notices_th": ["…รายละเอียดนโยบายถอนเงินเป็นภาษาไทย…"],
      "notices_en": ["…English policy bullets…"]
    }
  }
}
```

### `GET /api/wallet/bank-options`

รายการธนาคาร + **นโยบายค่าธรรมเนียม 5%** (`fee_percent`, `policy_notices_th`, `policy_notices_en`) สำหรับแสดงบนฟอร์มถอน

### `POST /api/wallet/withdraw`

- **`amount`** = ยอดรวมที่หักจาก “ยอดถอนได้” (ก่อนหักค่าธรรมเนียม / gross)
- **ค่าธรรมเนียม 5%** คำนวณจาก `amount` แล้วหักออกจากยอดโอน — ยอดโอนเข้าบัญชี = `amount × 0.95` (ปัดทศนิยม 2 ตำแหน่ง)

Body (ตัวเลขบัญชีจะเก็บเฉพาะหลัก 0–9 หลัง normalize):

```json
{
  "amount": 1000,
  "bank_code": "KBANK",
  "account_holder_name": "สมชาย ใจดี",
  "account_number": "1234567890"
}
```

- `bank_code` ต้องอยู่ในรายการจาก `GET /wallet/bank-options`
- `account_holder_name` ชื่อบัญชี (ไม่บังคับตรงกับชื่อผู้ขายในระบบ แต่แอดมินตรวจได้)
- `account_number` 8–20 หลัก (ขีด/ช่องว่างจะถูกตัดออกก่อนบันทึก)

ตัวอย่าง response (สรุป):

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "ส่งคำขอถอนเงินแล้ว หักจากยอดถอนได้ 1000.00 บาท (ค่าธรรมเนียม 5% = 50.00 บาท) คาดว่าโอนเข้าบัญชี 950.00 บาท (สุทธิ) …",
    "message_en": "Withdrawal submitted. Deducted 1000.00 THB gross; fee 5% (50.00 THB); estimated bank payout 950.00 THB net …",
    "fee_breakdown": {
      "gross_amount": 1000,
      "fee_percent": 5,
      "fee_rate": 0.05,
      "fee_amount": 50,
      "net_payout_amount": 950
    },
    "notices_th": ["…รายการอธิบายเป็นภาษาไทยหลายข้อ…"],
    "notices_en": ["…English bullet points…"],
    "withdrawal": {
      "id": "uuid",
      "amount": 1000,
      "withdrawal_fee_amount": 50,
      "net_payout_amount": 950,
      "status": "pending",
      "requested_at": "2026-04-17T12:00:00.000Z",
      "bank_code": "KBANK",
      "account_holder_name": "สมชาย ใจดี",
      "account_number_last4": "7890"
    }
  }
}
```

`GET /api/wallet` ส่ง `withdrawal_policy` (ยอดค่าธรรมเนียม + `notices_th` / `notices_en` แบบไม่ผูกยอด) เพื่อให้หน้าเว็บแสดงก่อนกดถอน

`available_balance` หักทันทีตาม **gross**; แอดมิน **reject** คืนเต็ม gross

### `GET /api/wallet/withdrawals?limit=50&offset=0`

คืนรายการถอนของผู้ขาย — รวม `withdrawal_fee_amount`, `net_payout_amount` และ `account_number_last4` เท่านั้น (ไม่คืนเลขเต็ม)

### DB migration

1. `backend/db/migrations/20260418_withdrawals_payout_bank.sql` — คอลัมน์บัญชีธนาคาร  
2. `backend/db/migrations/20260419_withdrawals_fee.sql` — `withdrawal_fee_amount`, `net_payout_amount`

## Buyer

### `POST /api/orders/:orderId/confirm-delivery`

Sets `buyer_confirmed_delivery_at` and attempts escrow release (idempotent).

## Admin

### `GET /api/admin/wallet/dashboard`

Withdrawal counts by status + sum of `seller_wallets` balances.

### `GET /api/admin/withdrawals?status=pending&limit=50&offset=0`

### `POST /api/admin/withdrawals/:id/approve`

Body (optional): `{ "admin_notes": "OK" }` — `pending` → `approved`.

### `POST /api/admin/withdrawals/:id/reject`

Body (optional): `{ "admin_notes": "..." }` — refunds `available_balance`, `pending` → `rejected`.

### `POST /api/admin/withdrawals/:id/mark-paid`

`approved` → `paid` (payout completed).

### `GET /api/admin/sellers/:sellerId/wallet`

### `POST /api/admin/orders/:orderId/mark-delivered`

Forces `shipping_status = delivered` and runs release logic.

## Order payload additions

Each order from existing endpoints may include:

- `order_lifecycle`: `pending` | `paid` | `shipped` | `delivered` | `completed` | … (derived from payment status, shipping, settlement)
- `buyer_confirmed_delivery_at`, `funds_settled_at`

## Edge cases

- **Double release**: blocked by unique `(order_id, seller_id)` on `release` rows + per-seller checks.
- **No escrow row for seller**: release skipped for that seller (log `release_failed_insufficient_escrow` if balance move fails).
- **Multi-seller orders**: each seller gets separate escrow/release lines; `funds_settled_at` when release count matches count of sellers with positive share.
- **Fulfillment + HTTP tracking**: 17TRACK runs **outside** the DB transaction; balance updates run in a short transaction afterward.

## Webhooks / fees (optional)

Not implemented in this revision; extend `wallet_transactions.metadata` and add provider webhooks as needed.
