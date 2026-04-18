-- Yardsale eCommerce schema — PostgreSQL
-- Run: psql $DATABASE_URL -f db/schema.sql
-- Idempotent: รันซ้ำได้ (npm run db:schema) โดยไม่ล้มถ้ามี type/ตารางแล้ว

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'seller', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE user_account_status AS ENUM ('public', 'pending', 'block');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'paid', 'canceled', 'payment_failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_listing_status AS ENUM ('pending_review', 'published', 'hidden');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  /* OAuth / social: ไม่มีรหัสผ่าน — ต้อง NULL ได้; ล็อกอินอีเมลตรวจใน auth.service */
  password_hash TEXT,
  name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* users: สถานะบัญชี (รันซ้ำได้) */
DO $ensure_user_account_status$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN account_status user_account_status NOT NULL DEFAULT 'public';
  END IF;
END $ensure_user_account_status$;

/* ฐานเก่า: password_hash เคยเป็น NOT NULL — ต้องยกเลิกเพื่อรองรับ OAuth */
DO $ensure_password_hash_nullable$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $ensure_password_hash_nullable$;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ฐานเก่าที่สร้าง categories ก่อนมี image_url — ต้อง ALTER (รันซ้ำได้) */
DO $ensure_cat_img$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN image_url TEXT;
  END IF;
END $ensure_cat_img$;

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  regular_price NUMERIC(12, 2),
  sale_price NUMERIC(12, 2),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  image_urls TEXT[],
  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  listing_status product_listing_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ตาราง products เก่า (ก่อนมี listing_status): เพิ่มคอลัมน์ก่อนสร้าง index — รันซ้ำได้ */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'listing_status'
  ) THEN
    ALTER TABLE products
      ADD COLUMN listing_status product_listing_status NOT NULL DEFAULT 'published';
    ALTER TABLE products
      ALTER COLUMN listing_status SET DEFAULT 'pending_review';
  END IF;
END $$;

/* products เก่า: เพิ่มราคาเต็ม / ลดราคา (รันซ้ำได้) */
DO $ensure_prod_prices$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'regular_price'
  ) THEN
    ALTER TABLE public.products ADD COLUMN regular_price NUMERIC(12, 2);
    ALTER TABLE public.products ADD COLUMN sale_price NUMERIC(12, 2);
    UPDATE public.products SET regular_price = price WHERE regular_price IS NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'sale_price'
  ) THEN
    ALTER TABLE public.products ADD COLUMN sale_price NUMERIC(12, 2);
  END IF;
END $ensure_prod_prices$;

/* products เก่า: รองรับหลายรูป (text[]) */
DO $ensure_prod_image_urls$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE public.products ADD COLUMN image_urls TEXT[];
    UPDATE public.products
    SET image_urls = CASE
      WHEN image_url IS NULL OR image_url = '' THEN NULL
      ELSE ARRAY[image_url]
    END
    WHERE image_urls IS NULL;
  END IF;
END $ensure_prod_image_urls$;

/* ผลตรวจสอบจากแอดมิน (เหตุผลที่ไม่ผ่าน — แจ้งผู้ขาย) */
DO $ensure_prod_moderation_feedback$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'moderation_feedback'
  ) THEN
    ALTER TABLE public.products ADD COLUMN moderation_feedback JSONB;
  END IF;
END $ensure_prod_moderation_feedback$;

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_cancelled ON products (is_cancelled);
CREATE INDEX IF NOT EXISTS idx_products_listing_status ON products (listing_status);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products (name);

/* เชื่อมสินค้า–แท็ก (รันซ้ำได้) */
CREATE TABLE IF NOT EXISTS product_tags (
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON product_tags (tag_id);

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  status order_status NOT NULL DEFAULT 'pending',
  slip_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

/* orders: snapshot ที่อยู่ผู้สั่ง + สถานะจัดส่ง (ผู้ขายอัปเดต) — รันซ้ำได้ */
DO $ensure_order_fulfillment$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'billing_snapshot'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN billing_snapshot JSONB;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_status'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN shipping_status TEXT NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN tracking_number TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_receipt_number'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN shipping_receipt_number TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'courier_name'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN courier_name TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'fulfillment_updated_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN fulfillment_updated_at TIMESTAMPTZ;
  END IF;
END $ensure_order_fulfillment$;

CREATE TABLE IF NOT EXISTS order_items (
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO categories (name, slug) VALUES ('General', 'general')
ON CONFLICT (slug) DO NOTHING;

/* 17TRACK / shipment lookup audit log — รันซ้ำได้ */
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

/* สลิปแต่ละครั้งที่อัปโหลดตรวจ — แสดงในแอดมิน */
CREATE TABLE IF NOT EXISTS order_slip_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_slip_snapshots_order ON order_slip_snapshots (order_id, created_at DESC);

/* FCM — รันซ้ำได้ */
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fcm_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens (user_id);

/* OAuth / social login — รันซ้ำได้ (password_hash nullable จัดแล้วด้านบน) */
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
