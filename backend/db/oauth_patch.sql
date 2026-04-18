/* OAuth — รันซ้ำได้ (user_oauth_identities + password_hash ต้อง NULL ได้สำหรับ social-only user) */

DO $ensure_password_hash_nullable$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $ensure_password_hash_nullable$;

DO $oauth_avatar$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar TEXT;
  END IF;
END $oauth_avatar$;

DO $oauth_auth_provider$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_provider'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'email'
      CONSTRAINT users_auth_provider_chk CHECK (auth_provider IN ('email', 'google', 'facebook', 'line'));
  END IF;
END $oauth_auth_provider$;

CREATE TABLE IF NOT EXISTS user_oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_oauth_provider_subject UNIQUE (provider, provider_user_id),
  CONSTRAINT uq_oauth_user_provider UNIQUE (user_id, provider),
  CONSTRAINT chk_oauth_provider_name CHECK (provider IN ('google', 'facebook', 'line'))
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user ON user_oauth_identities (user_id);
