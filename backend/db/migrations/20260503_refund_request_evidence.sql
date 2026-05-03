-- refund_requests.evidence_paths — หลักฐานแนบ (สลิป/รูป) JSON array of path strings e.g. ["/uploads/xxx.jpg"]
-- Idempotent

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refund_requests' AND column_name = 'evidence_paths'
  ) THEN
    ALTER TABLE public.refund_requests
      ADD COLUMN evidence_paths JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
