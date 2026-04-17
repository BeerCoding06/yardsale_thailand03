/**
 * เช็คสถานะการชำระจาก PostgreSQL โดยตรง (แหล่งความจริงของ payment vs list API / UI)
 *
 * Usage:
 *   cd backend && node scripts/check-order-payment.js <order-uuid>
 *   ORDER_ID=<uuid> node scripts/check-order-payment.js
 *
 * ต้องมี DATABASE_URL ใน .env หรือ env (เช่น Dokploy exec เข้า backend container)
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function main() {
  const id = String(process.argv[2] || process.env.ORDER_ID || '')
    .trim()
    .replace(/^\{|\}$/g, '');
  if (!id || !UUID_RE.test(id)) {
    console.error(
      'Usage: node scripts/check-order-payment.js <order-uuid>\n' +
        '   or: ORDER_ID=<uuid> node scripts/check-order-payment.js'
    );
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  return run(id, url);
}

async function run(orderId, connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT id, user_id, status::text AS status, slip_image_url, total_price, created_at
       FROM orders
       WHERE id = $1::uuid`,
      [orderId]
    );
    if (!r.rows.length) {
      console.log(JSON.stringify({ found: false, order_id: orderId }, null, 2));
      process.exit(2);
    }
    const row = r.rows[0];
    const paidish =
      row.status === 'paid' ||
      (row.slip_image_url != null &&
        String(row.slip_image_url).trim() !== '' &&
        row.status === 'pending');
    const out = {
      found: true,
      order_id: row.id,
      user_id: row.user_id,
      status: row.status,
      slip_image_url_set: !!(row.slip_image_url && String(row.slip_image_url).trim()),
      slip_image_url_preview:
        row.slip_image_url != null
          ? String(row.slip_image_url).slice(0, 120) +
            (String(row.slip_image_url).length > 120 ? '…' : '')
          : null,
      total_price: row.total_price,
      created_at: row.created_at,
      /** ถ้า status ยัง pending แต่มี slip_url ในแถว — อาจชำระแล้วแต่ enum ยังไม่อัปเดต (ผิดปกติ ควรเป็น paid) */
      heuristic_paidish: paidish,
    };
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
