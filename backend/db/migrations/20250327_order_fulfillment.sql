-- รันครั้งเดียวบน DB ที่มี orders อยู่แล้ว (ถ้า schema.sql รัน DO block แล้ว ข้ามได้)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_snapshot JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_receipt_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_updated_at TIMESTAMPTZ;
