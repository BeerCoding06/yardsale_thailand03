-- Add product_inspected boolean to refund_requests to allow admin to mark products inspected
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refund_requests' AND column_name = 'product_inspected'
  ) THEN
    ALTER TABLE public.refund_requests
    ADD COLUMN product_inspected boolean DEFAULT false;
  END IF;
END$$;
