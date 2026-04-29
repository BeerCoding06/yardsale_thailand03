-- Buyer wallet / refund system
-- Run: psql $DATABASE_URL -f db/migrations/20260429_buyer_wallet_system.sql
-- Idempotent: รันซ้ำได้ (ใช้ IF NOT EXISTS / DO block)

/* ===== ENUMs ===== */

DO $$ BEGIN
  CREATE TYPE buyer_wallet_tx_type AS ENUM ('credit', 'debit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE buyer_wallet_tx_source AS ENUM ('refund', 'purchase', 'admin_credit', 'admin_debit', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_reason AS ENUM ('order_cancelled', 'not_shipped_3_days', 'product_defect', 'admin_manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM ('pending', 'completed', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

/* ===== TABLES ===== */

-- กระเป๋าเงินผู้ซื้อ (1 กระเป๋าต่อ 1 user)
CREATE TABLE IF NOT EXISTS buyer_wallets (
  user_id    UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  balance    NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ประวัติธุรกรรมกระเป๋าผู้ซื้อ
CREATE TABLE IF NOT EXISTS buyer_wallet_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  order_id   UUID REFERENCES orders (id) ON DELETE SET NULL,
  type       buyer_wallet_tx_type NOT NULL,
  source     buyer_wallet_tx_source NOT NULL,
  amount     NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  note       TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bwt_user ON buyer_wallet_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bwt_order ON buyer_wallet_transactions (order_id);

-- กันรีฟันด์ซ้ำต่อ order (1 refund credit per order)
CREATE UNIQUE INDEX IF NOT EXISTS ux_bwt_refund_order
  ON buyer_wallet_transactions (order_id, user_id)
  WHERE type = 'credit' AND source = 'refund' AND order_id IS NOT NULL;

-- บันทึกรีฟันด์ (ตรวจสอบสถานะ + กัน duplicate)
CREATE TABLE IF NOT EXISTS refunds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount       NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  reason       refund_reason NOT NULL,
  status       refund_status NOT NULL DEFAULT 'pending',
  note         TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_refunds_order
  ON refunds (order_id)
  WHERE status IN ('pending', 'completed');

CREATE INDEX IF NOT EXISTS idx_refunds_user ON refunds (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds (status, created_at DESC);

/* ===== COLUMNS ADDED TO EXISTING TABLES ===== */

-- orders.paid_at: เวลาชำระเงินสำเร็จ (สำหรับเช็ค 3 วันไม่จัดส่ง)
DO $orders_paid_at$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
END $orders_paid_at$;

-- orders.wallet_amount_used: ยอดที่ใช้กระเป๋าเงินชำระในออเดอร์นี้
DO $orders_wallet_amount_used$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'wallet_amount_used'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN wallet_amount_used NUMERIC(14, 2) NOT NULL DEFAULT 0;
  END IF;
END $orders_wallet_amount_used$;

-- orders.refund_processed_at: เวลาที่รีฟันด์เข้ากระเป๋าแล้ว
DO $orders_refund_processed_at$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refund_processed_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN refund_processed_at TIMESTAMPTZ;
  END IF;
END $orders_refund_processed_at$;
