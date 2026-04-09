-- เก็บภาพ/ลิงก์สลิปทุกครั้งที่ลูกค้าอัปโหลดตรวจ (แอดมินดูใน CMS)
CREATE TABLE IF NOT EXISTS order_slip_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_slip_snapshots_order ON order_slip_snapshots (order_id, created_at DESC);
