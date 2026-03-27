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
  password_hash TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS order_items (
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO categories (name, slug) VALUES ('General', 'general')
ON CONFLICT (slug) DO NOTHING;
