-- Shipment tracking API audit log (17TRACK)
CREATE TABLE IF NOT EXISTS tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL,
  carrier TEXT,
  status TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_logs_number ON tracking_logs (tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_logs_created ON tracking_logs (created_at DESC);
