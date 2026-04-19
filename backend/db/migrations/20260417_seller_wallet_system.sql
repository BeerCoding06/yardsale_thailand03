-- Seller wallet (escrow → available), withdrawals, financial audit
-- Idempotent: safe to re-run

DO $$ BEGIN
  CREATE TYPE wallet_tx_type AS ENUM ('escrow_in', 'release', 'withdraw', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_tx_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS seller_wallets (
  seller_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  escrow_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (escrow_balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status withdrawal_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_seller ON withdrawals (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals (status, requested_at DESC);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders (id) ON DELETE SET NULL,
  withdrawal_id UUID REFERENCES withdrawals (id) ON DELETE SET NULL,
  type wallet_tx_type NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status wallet_tx_status NOT NULL DEFAULT 'completed',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_seller ON wallet_transactions (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_order ON wallet_transactions (order_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_escrow_order_seller
  ON wallet_transactions (order_id, seller_id)
  WHERE type = 'escrow_in' AND order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_wallet_release_order_seller
  ON wallet_transactions (order_id, seller_id)
  WHERE type = 'release' AND order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_audit_entity ON financial_audit_logs (entity_type, entity_id, created_at DESC);

DO $orders_wallet_cols$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'buyer_confirmed_delivery_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN buyer_confirmed_delivery_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'funds_settled_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN funds_settled_at TIMESTAMPTZ;
  END IF;
END $orders_wallet_cols$;
