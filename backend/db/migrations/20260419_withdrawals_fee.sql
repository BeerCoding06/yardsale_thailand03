-- ค่าธรรมเนียมถอน 5% (ยอด amount = ยอดรวมที่หักจากกระเป๋า, net_payout = โอนเข้าบัญชี)

DO $f$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'withdrawal_fee_amount'
  ) THEN
    ALTER TABLE public.withdrawals ADD COLUMN withdrawal_fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'net_payout_amount'
  ) THEN
    ALTER TABLE public.withdrawals ADD COLUMN net_payout_amount NUMERIC(14, 2);
  END IF;
END $f$;

UPDATE public.withdrawals
SET
  withdrawal_fee_amount = ROUND((amount * 0.05)::numeric, 2),
  net_payout_amount = ROUND((amount * 0.95)::numeric, 2)
WHERE (withdrawal_fee_amount IS NULL OR withdrawal_fee_amount = 0)
  AND amount IS NOT NULL
  AND amount > 0;
