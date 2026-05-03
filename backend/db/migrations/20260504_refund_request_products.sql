-- Add product_items JSONB to refund_requests to record which products (and quantities) are claimed for refund
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'refund_requests' AND column_name = 'product_items'
  ) THEN
    ALTER TABLE public.refund_requests
      ADD COLUMN product_items JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
