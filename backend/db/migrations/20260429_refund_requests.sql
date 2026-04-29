-- Refund Requests — user-initiated refund workflow (requires admin review)
-- Separate from the auto-processed `refunds` table (cancel / unshipped triggers)
-- Run: psql $DATABASE_URL -f db/migrations/20260429_refund_requests.sql
-- Idempotent

DO $$ BEGIN
  CREATE TYPE refund_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS refund_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  reason      refund_reason NOT NULL DEFAULT 'product_defect',
  note        TEXT,

  status      refund_request_status NOT NULL DEFAULT 'pending',

  -- Admin review
  admin_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  admin_note  TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Linked to actual refund record after approval
  refund_id   UUID REFERENCES refunds (id) ON DELETE SET NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ผู้ซื้อ 1 ออเดอร์ ส่งคำขอได้ 1 ครั้ง (ห้ามซ้ำ)
CREATE UNIQUE INDEX IF NOT EXISTS ux_refund_requests_order
  ON refund_requests (order_id);

CREATE INDEX IF NOT EXISTS idx_rr_user   ON refund_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_status ON refund_requests (status, created_at DESC);
