/** null = ยังไม่เช็ก; รันครั้งแรกแล้ว cache (DB เก่ายังไม่มี listing_status ก็ไม่พัง) */
let cachedListingStatusColumn = null;

async function hasListingStatusColumn(client) {
  if (cachedListingStatusColumn !== null) return cachedListingStatusColumn;
  try {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'listing_status'
      ) AS ok`
    );
    cachedListingStatusColumn = r.rows[0]?.ok === true;
  } catch {
    cachedListingStatusColumn = false;
  }
  return cachedListingStatusColumn;
}

function baseSelectColumns() {
  return `
    p.id, p.name, p.description, p.price, p.stock, p.category_id, p.seller_id,
    p.image_url, p.is_cancelled, p.listing_status, p.created_at,
    c.name AS category_name, c.slug AS category_slug`;
}

function baseSelectColumnsLegacy() {
  return `
    p.id, p.name, p.description, p.price, p.stock, p.category_id, p.seller_id,
    p.image_url, p.is_cancelled, p.created_at,
    c.name AS category_name, c.slug AS category_slug`;
}

function baseProductFrom() {
  return `
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id`;
}

/** รายการหน้าร้าน / ค้นหา: เฉพาะเผยแพร่ + ไม่ยกเลิก */
export function sqlPublicProductWhere() {
  return ` WHERE p.is_cancelled = false AND p.listing_status = 'published'`;
}

export async function listProducts(
  client,
  { search, categoryId, categorySlug, publicOnly = true } = {}
) {
  const hasLs = await hasListingStatusColumn(client);
  const cols = hasLs ? baseSelectColumns() : baseSelectColumnsLegacy();
  let baseWhere;
  if (hasLs) {
    baseWhere = publicOnly ? sqlPublicProductWhere() : ` WHERE p.is_cancelled = false`;
  } else {
    baseWhere = ` WHERE p.is_cancelled = false`;
  }
  let sql = `SELECT ${cols} ${baseProductFrom()}${baseWhere}`;
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
  }
  if (categoryId) {
    params.push(categoryId);
    sql += ` AND p.category_id = $${params.length}`;
  }
  if (categorySlug) {
    params.push(categorySlug);
    sql += ` AND c.slug = $${params.length}`;
  }
  sql += ' ORDER BY p.created_at DESC';
  const r = await client.query(sql, params);
  return r.rows;
}

export async function getProductById(
  client,
  id,
  { includeCancelled = false, requirePublished = true, viewerSellerId = null } = {}
) {
  const hasLs = await hasListingStatusColumn(client);
  const cols = hasLs ? baseSelectColumns() : baseSelectColumnsLegacy();
  let sql = `SELECT ${cols} ${baseProductFrom()} WHERE p.id = $1`;
  const params = [id];
  if (!includeCancelled) sql += ' AND p.is_cancelled = false';

  if (requirePublished && hasLs) {
    if (viewerSellerId) {
      params.push(viewerSellerId);
      sql += ` AND (p.listing_status = 'published' OR p.seller_id = $${params.length})`;
    } else {
      sql += ` AND p.listing_status = 'published'`;
    }
  }

  const r = await client.query(sql, params);
  const row = r.rows[0] || null;
  if (row && !hasLs) {
    row.listing_status = 'published';
  }
  return row;
}

export async function getProductForPurchase(client, productId) {
  const hasLs = await hasListingStatusColumn(client);
  const cols = hasLs ? baseSelectColumns() : baseSelectColumnsLegacy();
  const whereLs = hasLs ? ` AND p.listing_status = 'published'` : '';
  const r = await client.query(
    `SELECT ${cols} ${baseProductFrom()}
     WHERE p.id = $1 AND p.is_cancelled = false${whereLs}`,
    [productId]
  );
  return r.rows[0] || null;
}

export async function lockProductsForUpdate(client, productIds) {
  if (!productIds.length) return [];
  const hasLs = await hasListingStatusColumn(client);
  const extra = hasLs ? ', listing_status' : '';
  const r = await client.query(
    `SELECT id, name, price, stock, seller_id, is_cancelled${extra}
     FROM products
     WHERE id = ANY($1::uuid[])
     FOR UPDATE`,
    [productIds]
  );
  return r.rows;
}

export async function decrementProductStock(client, productId, qty) {
  const r = await client.query(
    `UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2 RETURNING id`,
    [productId, qty]
  );
  return r.rowCount === 1;
}

export async function incrementProductStock(client, productId, qty) {
  await client.query(`UPDATE products SET stock = stock + $2 WHERE id = $1`, [productId, qty]);
}

export async function createProduct(client, row) {
  const hasLs = await hasListingStatusColumn(client);
  if (hasLs) {
    const r = await client.query(
      `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url, listing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::product_listing_status, 'pending_review'::product_listing_status))
       RETURNING id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled, listing_status, created_at`,
      [
        row.seller_id,
        row.category_id || null,
        row.name,
        row.description || '',
        row.price,
        row.stock ?? 0,
        row.image_url || null,
        row.listing_status || null,
      ]
    );
    return r.rows[0];
  }
  const r = await client.query(
    `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled, created_at`,
    [
      row.seller_id,
      row.category_id || null,
      row.name,
      row.description || '',
      row.price,
      row.stock ?? 0,
      row.image_url || null,
    ]
  );
  return r.rows[0];
}

export async function listProductsBySeller(client, sellerId) {
  const hasLs = await hasListingStatusColumn(client);
  const lsCol = hasLs ? ', listing_status' : '';
  const r = await client.query(
    `SELECT id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled${lsCol}, created_at
     FROM products WHERE seller_id = $1 ORDER BY created_at DESC`,
    [sellerId]
  );
  return r.rows;
}

export async function listAllProducts(client) {
  const hasLs = await hasListingStatusColumn(client);
  const lsCol = hasLs ? ', listing_status' : '';
  const r = await client.query(
    `SELECT id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled${lsCol}, created_at
     FROM products ORDER BY created_at DESC`
  );
  return r.rows;
}

export async function updateProduct(client, productId, body, sellerId, isAdmin) {
  const hasLs = await hasListingStatusColumn(client);
  const sets = [];
  const params = [];
  let n = 1;
  if (body.name !== undefined) {
    sets.push(`name = $${n++}`);
    params.push(body.name);
  }
  if (body.description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(body.description);
  }
  if (body.price !== undefined) {
    sets.push(`price = $${n++}`);
    params.push(body.price);
  }
  if (body.stock !== undefined) {
    sets.push(`stock = $${n++}`);
    params.push(body.stock);
  }
  if (body.category_id !== undefined) {
    sets.push(`category_id = $${n++}`);
    params.push(body.category_id && body.category_id !== '' ? body.category_id : null);
  }
  if (body.image_url !== undefined) {
    sets.push(`image_url = $${n++}`);
    params.push(body.image_url || null);
  }
  if (hasLs && body.listing_status !== undefined && isAdmin) {
    sets.push(`listing_status = $${n++}`);
    params.push(body.listing_status);
  }
  if (!sets.length) return null;
  params.push(productId);
  let sql = `UPDATE products SET ${sets.join(', ')} WHERE id = $${n}`;
  if (!isAdmin) {
    params.push(sellerId);
    sql += ` AND seller_id = $${n + 1}`;
  }
  const ret = hasLs
    ? `id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled, listing_status, created_at`
    : `id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled, created_at`;
  sql += ` RETURNING ${ret}`;
  const r = await client.query(sql, params);
  return r.rows[0] || null;
}

export async function setProductCancelled(client, productId, sellerId, cancelled) {
  const r = await client.query(
    `UPDATE products SET is_cancelled = $3
     WHERE id = $1 AND seller_id = $2
     RETURNING id, is_cancelled`,
    [productId, sellerId, cancelled]
  );
  return r.rows[0] || null;
}

export async function setProductCancelledById(client, productId, cancelled) {
  const r = await client.query(
    `UPDATE products SET is_cancelled = $2 WHERE id = $1 RETURNING id, is_cancelled`,
    [productId, cancelled]
  );
  return r.rows[0] || null;
}
