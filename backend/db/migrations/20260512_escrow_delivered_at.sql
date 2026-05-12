-- Escrow release: 48h after physical delivery unless buyer confirms earlier
-- Idempotent

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'auto_confirmed_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN auto_confirmed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ออเดอร์ที่จัดส่งแล้วแต่ยังไม่มี delivered_at → ใช้ fulfillment_updated_at / created_at (ให้ cron ปล่อยได้หลัง 48 ชม. จาก timestamp นั้น)
UPDATE orders o
SET delivered_at = COALESCE(o.fulfillment_updated_at, o.created_at)
WHERE o.delivered_at IS NULL
  AND o.status = 'paid'
  AND LOWER(TRIM(COALESCE(o.shipping_status::text, ''))) = 'delivered';
