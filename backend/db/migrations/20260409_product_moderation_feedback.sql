-- products.moderation_feedback: admin review notes for sellers (JSONB)
DO $ensure_prod_moderation_feedback$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'moderation_feedback'
  ) THEN
    ALTER TABLE public.products ADD COLUMN moderation_feedback JSONB;
  END IF;
END $ensure_prod_moderation_feedback$;
