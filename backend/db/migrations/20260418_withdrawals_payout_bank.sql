-- ข้อมูลบัญชีรับโอนสำหรับคำขอถอนเงิน (รันซ้ำได้)

DO $w$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'payout_bank_code'
  ) THEN
    ALTER TABLE public.withdrawals ADD COLUMN payout_bank_code TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'payout_account_name'
  ) THEN
    ALTER TABLE public.withdrawals ADD COLUMN payout_account_name TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'withdrawals' AND column_name = 'payout_account_number'
  ) THEN
    ALTER TABLE public.withdrawals ADD COLUMN payout_account_number TEXT;
  END IF;
END $w$;
