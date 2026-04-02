/**
 * Creates demo admin + seller + sample products (run after schema).
 * Usage: DATABASE_URL=... node scripts/seed-demo.js
 *
 * Login admin UI: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (defaults below).
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const SALT_ROUNDS = 12;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@demo.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123456';
    const adminHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    const adminRow = (await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [adminEmail])).rows[0];
    if (!adminRow) {
      await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, 'Demo Admin', 'admin'::user_role)`,
        [adminEmail, adminHash]
      );
    } else {
      if (process.env.SEED_RESET_ADMIN_PASSWORD === '1') {
        await client.query(`UPDATE users SET password_hash = $2, role = 'admin'::user_role WHERE id = $1`, [
          adminRow.id,
          adminHash,
        ]);
      } else {
      }
    }

    const email = process.env.SEED_SELLER_EMAIL || 'seller@demo.local';
    const password = process.env.SEED_SELLER_PASSWORD || 'demo123456';
    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    let seller = (await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email])).rows[0];
    if (!seller) {
      seller = (
        await client.query(
          `INSERT INTO users (email, password_hash, name, role)
           VALUES ($1, $2, 'Demo Seller', 'seller'::user_role)
           RETURNING id`,
          [email, hash]
        )
      ).rows[0];
    } else {
    }

    const cat = (await client.query(`SELECT id FROM categories WHERE slug = 'general' LIMIT 1`)).rows[0];
    const categoryId = cat?.id || null;

    await client.query(
      `INSERT INTO tags (name, slug) VALUES ('มือสอง', 'used'), ('Sale', 'sale')
       ON CONFLICT (slug) DO NOTHING`
    );

    const count = (await client.query(`SELECT COUNT(*)::int AS c FROM products WHERE seller_id = $1`, [seller.id]))
      .rows[0].c;
    if (count > 0) {
      return;
    }

    await client.query(
      `INSERT INTO products (seller_id, category_id, name, description, price, regular_price, sale_price, stock, image_url, listing_status)
       VALUES
         ($1, $2, 'Demo T-Shirt', 'Cotton tee', 29.99, 29.99, NULL, 50, NULL, 'published'::product_listing_status),
         ($1, $2, 'Demo Mug', 'Ceramic', 12.00, 12.00, NULL, 100, NULL, 'published'::product_listing_status)`,
      [seller.id, categoryId]
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  if (String(e?.message || '').includes('role "postgres" does not exist')) {
    console.error(
      '\n[hint] On macOS Homebrew Postgres there is often no "postgres" role. Set DATABASE_URL in backend/.env to use your Mac username, e.g.\n' +
        '  postgresql://' +
        (process.env.USER || 'YOUR_USER') +
        '@127.0.0.1:5432/yardsale\n' +
        'Or omit the user: postgresql://127.0.0.1:5432/yardsale\n' +
        'See backend/.env.example\n'
    );
  }
  process.exit(1);
});
