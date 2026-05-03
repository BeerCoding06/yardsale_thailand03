-- Add rejection_reason column to refund_requests to store structured rejection reasons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refund_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.refund_requests
      ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;
