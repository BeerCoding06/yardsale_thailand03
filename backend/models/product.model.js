import { AppError } from '../utils/AppError.js';
import { ilikeContainsPattern } from '../utils/pagination.js';

/** คีย์เหตุผลที่แอดมินเลือกได้ — ต้องตรงกับ Joi / ฝั่งแอดมิน */
const MODERATION_ISSUE_KEYS = new Set([
  'photos',
  'title_name',
  'description',
  'price',
  'category',
  'stock',
  'tags',
  'illegal_or_prohibited',
  'other',
]);

/** เช็กทุกครั้ง — ไม่ cache เพื่อให้หลังรัน migration ไม่ต้องรีสตาร์ท API */
async function hasListingStatusColumn(client) {
  try {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'listing_status'
      ) AS ok`
    );
    return r.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

async function hasProductPriceBreakdown(client) {
  try {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'regular_price'
      ) AS ok`
    );
    return r.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

async function hasProductImageUrlsColumn(client) {
  try {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'image_urls'
      ) AS ok`
    );
    return r.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

async function hasModerationFeedbackColumn(client) {
  try {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'moderation_feedback'
      ) AS ok`
    );
    return r.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

async function hasProductTagsTable(client) {
  try {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name = 'product_tags'
      ) AS ok`
    );
    return r.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

/** แทนที่ความสัมพันธ์แท็กทั้งหมดของสินค้า (เฉพาะ tag_id ที่มีในตาราง tags) */
export async function replaceProductTags(client, productId, tagIds) {
  if (!(await hasProductTagsTable(client))) return;
  const ids = [...new Set((tagIds || []).map((id) => String(id).trim()).filter(Boolean))];
  await client.query('DELETE FROM product_tags WHERE product_id = $1', [productId]);
  if (!ids.length) return;
  await client.query(
    `INSERT INTO product_tags (product_id, tag_id)
     SELECT $1::uuid, t.id
     FROM tags t
     WHERE t.id = ANY($2::uuid[])`,
    [productId, ids]
  );
}

export async function attachTagsToProductRow(client, row) {
  if (!row) return;
  if (!(await hasProductTagsTable(client))) {
    row.tags = [];
    row.tag_ids = [];
    return;
  }
  const r = await client.query(
    `SELECT t.id, t.name, t.slug
     FROM tags t
     INNER JOIN product_tags pt ON pt.tag_id = t.id
     WHERE pt.product_id = $1
     ORDER BY t.name`,
    [row.id]
  );
  row.tags = r.rows;
  row.tag_ids = r.rows.map((x) => x.id);
}

async function joinProductSelectColumns(client) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const hasMod = await hasModerationFeedbackColumn(client);
  const priceCols = hasPb
    ? `p.price, p.regular_price, p.sale_price,`
    : `p.price,`;
  const imgCols = hasImgs ? `p.image_url, p.image_urls,` : `p.image_url,`;
  const modFrag = hasMod ? 'p.moderation_feedback, ' : '';
  if (hasLs) {
    return `
    p.id, p.name, p.description, ${priceCols} p.stock, p.category_id, p.seller_id,
    ${imgCols} p.is_cancelled, p.listing_status, ${modFrag}p.created_at,
    c.name AS category_name, c.slug AS category_slug`;
  }
  return `
    p.id, p.name, p.description, ${priceCols} p.stock, p.category_id, p.seller_id,
    ${imgCols} p.is_cancelled, ${modFrag}p.created_at,
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
  {
    search,
    categoryId,
    categorySlug,
    publicOnly = true,
    limit,
    offset,
    sortOrder = 'DESC',
    sortField = 'DATE',
  } = {}
) {
  const hasLs = await hasListingStatusColumn(client);
  const cols = await joinProductSelectColumns(client);
  const hasPb = await hasProductPriceBreakdown(client);
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
  const ord = String(sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const fld = String(sortField || 'DATE').toUpperCase() === 'PRICE' ? 'PRICE' : 'DATE';
  if (fld === 'PRICE') {
    const priceExpr = hasPb
      ? `(CASE WHEN p.sale_price IS NOT NULL AND p.sale_price > 0 AND COALESCE(p.regular_price, p.price) > p.sale_price THEN p.sale_price ELSE COALESCE(p.regular_price, p.price) END)`
      : 'p.price';
    sql += ` ORDER BY ${priceExpr} ${ord} NULLS LAST, p.created_at DESC, p.id DESC`;
  } else {
    sql += ` ORDER BY p.created_at ${ord}, p.id DESC`;
  }
  if (limit != null && limit !== undefined) {
    const lim = Math.min(Math.max(Number(limit), 1), 100);
    const off = Math.max(Number(offset) || 0, 0);
    params.push(lim, off);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }
  const r = await client.query(sql, params);
  return r.rows;
}

/** นับจำนวนสินค้าหน้าร้าน — เงื่อนไขเดียวกับ listProducts */
export async function countListProducts(
  client,
  { search, categoryId, categorySlug, publicOnly = true } = {}
) {
  const hasLs = await hasListingStatusColumn(client);
  let baseWhere;
  if (hasLs) {
    baseWhere = publicOnly ? sqlPublicProductWhere() : ` WHERE p.is_cancelled = false`;
  } else {
    baseWhere = ` WHERE p.is_cancelled = false`;
  }
  let sql = `SELECT COUNT(*)::int AS c ${baseProductFrom()}${baseWhere}`;
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
  const r = await client.query(sql, params);
  return r.rows[0]?.c ?? 0;
}

export async function getProductById(
  client,
  id,
  { includeCancelled = false, requirePublished = true, viewerSellerId = null } = {}
) {
  const hasLs = await hasListingStatusColumn(client);
  const cols = await joinProductSelectColumns(client);
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
  if (row) await attachTagsToProductRow(client, row);
  return row;
}

export async function getProductForPurchase(client, productId) {
  const hasLs = await hasListingStatusColumn(client);
  const cols = await joinProductSelectColumns(client);
  const whereLs = hasLs ? ` AND p.listing_status = 'published'` : '';
  const r = await client.query(
    `SELECT ${cols} ${baseProductFrom()}
     WHERE p.id = $1 AND p.is_cancelled = false${whereLs}`,
    [productId]
  );
  const prow = r.rows[0] || null;
  if (prow) await attachTagsToProductRow(client, prow);
  return prow;
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

async function returningProductColumns(client) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const hasMod = await hasModerationFeedbackColumn(client);
  let base =
    'id, name, description, price, stock, category_id, seller_id, image_url, is_cancelled';
  if (hasImgs) base += ', image_urls';
  if (hasPb) base += ', regular_price, sale_price';
  if (hasLs) base += ', listing_status';
  if (hasMod) base += ', moderation_feedback';
  base += ', created_at';
  return base;
}

async function finalizeNewProduct(client, created, tagIds) {
  if (!created) return null;
  await replaceProductTags(client, created.id, Array.isArray(tagIds) ? tagIds : []);
  await attachTagsToProductRow(client, created);
  return created;
}

export async function createProduct(client, row) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const ret = await returningProductColumns(client);
  const rp = row.regular_price ?? row.price;
  const sp =
    row.sale_price != null && row.sale_price !== '' ? row.sale_price : null;
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.map((u) => String(u || '').trim()).filter(Boolean)
    : [];
  const primaryImage = row.image_url || imageUrls[0] || null;

  if (hasLs) {
    if (hasPb) {
      if (hasImgs) {
        const r = await client.query(
          `INSERT INTO products (seller_id, category_id, name, description, price, regular_price, sale_price, stock, image_url, image_urls, listing_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], COALESCE($11::product_listing_status, 'pending_review'::product_listing_status))
           RETURNING ${ret}`,
          [
            row.seller_id,
            row.category_id || null,
            row.name,
            row.description || '',
            row.price,
            rp,
            sp,
            row.stock ?? 0,
            primaryImage,
            imageUrls.length ? imageUrls : null,
            row.listing_status || null,
          ]
        );
        return finalizeNewProduct(client, r.rows[0], row.tag_ids);
      }
      const r = await client.query(
        `INSERT INTO products (seller_id, category_id, name, description, price, regular_price, sale_price, stock, image_url, listing_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::product_listing_status, 'pending_review'::product_listing_status))
         RETURNING ${ret}`,
        [
          row.seller_id,
          row.category_id || null,
          row.name,
          row.description || '',
          row.price,
          rp,
          sp,
          row.stock ?? 0,
          primaryImage,
          row.listing_status || null,
        ]
      );
      return finalizeNewProduct(client, r.rows[0], row.tag_ids);
    }
    if (hasImgs) {
      const r = await client.query(
        `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url, image_urls, listing_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], COALESCE($9::product_listing_status, 'pending_review'::product_listing_status))
         RETURNING ${ret}`,
        [
          row.seller_id,
          row.category_id || null,
          row.name,
          row.description || '',
          row.price,
          row.stock ?? 0,
          primaryImage,
          imageUrls.length ? imageUrls : null,
          row.listing_status || null,
        ]
      );
      return finalizeNewProduct(client, r.rows[0], row.tag_ids);
    }
    const r = await client.query(
      `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url, listing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::product_listing_status, 'pending_review'::product_listing_status))
       RETURNING ${ret}`,
      [
        row.seller_id,
        row.category_id || null,
        row.name,
        row.description || '',
        row.price,
        row.stock ?? 0,
        primaryImage,
        row.listing_status || null,
      ]
    );
    return finalizeNewProduct(client, r.rows[0], row.tag_ids);
  }
  if (hasPb) {
    if (hasImgs) {
      const r = await client.query(
        `INSERT INTO products (seller_id, category_id, name, description, price, regular_price, sale_price, stock, image_url, image_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[])
         RETURNING ${ret}`,
        [
          row.seller_id,
          row.category_id || null,
          row.name,
          row.description || '',
          row.price,
          rp,
          sp,
          row.stock ?? 0,
          primaryImage,
          imageUrls.length ? imageUrls : null,
        ]
      );
      return finalizeNewProduct(client, r.rows[0], row.tag_ids);
    }
    const r = await client.query(
      `INSERT INTO products (seller_id, category_id, name, description, price, regular_price, sale_price, stock, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${ret}`,
      [
        row.seller_id,
        row.category_id || null,
        row.name,
        row.description || '',
        row.price,
        rp,
        sp,
        row.stock ?? 0,
        primaryImage,
      ]
    );
    return finalizeNewProduct(client, r.rows[0], row.tag_ids);
  }
  if (hasImgs) {
    const r = await client.query(
      `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[])
       RETURNING ${ret}`,
      [
        row.seller_id,
        row.category_id || null,
        row.name,
        row.description || '',
        row.price,
        row.stock ?? 0,
        primaryImage,
        imageUrls.length ? imageUrls : null,
      ]
    );
    return finalizeNewProduct(client, r.rows[0], row.tag_ids);
  }
  const r = await client.query(
    `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${ret}`,
    [
      row.seller_id,
      row.category_id || null,
      row.name,
      row.description || '',
      row.price,
      row.stock ?? 0,
      primaryImage,
    ]
  );
  return finalizeNewProduct(client, r.rows[0], row.tag_ids);
}

export async function listProductsBySeller(client, sellerId) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const hasMod = await hasModerationFeedbackColumn(client);
  const priceCols = hasPb ? 'price, regular_price, sale_price,' : 'price,';
  const imgCols = hasImgs ? 'image_url, image_urls,' : 'image_url,';
  const lsCol = hasLs ? ', listing_status' : '';
  const modCol = hasMod ? ', moderation_feedback' : '';
  const r = await client.query(
    `SELECT id, name, description, ${priceCols} stock, category_id, seller_id, ${imgCols} is_cancelled${lsCol}${modCol}, created_at
     FROM products WHERE seller_id = $1 ORDER BY created_at DESC`,
    [sellerId]
  );
  return r.rows;
}

export async function countProductsBySeller(client, sellerId, search) {
  const like = ilikeContainsPattern(search);
  const params = [sellerId];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      p.name ILIKE $2 ESCAPE '\\'
      OR COALESCE(p.description,'') ILIKE $2 ESCAPE '\\'
      OR CAST(p.id AS TEXT) ILIKE $2 ESCAPE '\\'
    )`;
  }
  const r = await client.query(
    `SELECT COUNT(*)::int AS c FROM products p WHERE p.seller_id = $1::uuid ${extra}`,
    params
  );
  return r.rows[0]?.c ?? 0;
}

export async function listProductsBySellerPaged(client, sellerId, { limit, offset, search }) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const hasMod = await hasModerationFeedbackColumn(client);
  const priceCols = hasPb ? 'price, regular_price, sale_price,' : 'price,';
  const imgCols = hasImgs ? 'image_url, image_urls,' : 'image_url,';
  const lsCol = hasLs ? ', listing_status' : '';
  const modCol = hasMod ? ', moderation_feedback' : '';
  const like = ilikeContainsPattern(search);
  const params = [sellerId];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      p.name ILIKE $2 ESCAPE '\\'
      OR COALESCE(p.description,'') ILIKE $2 ESCAPE '\\'
      OR CAST(p.id AS TEXT) ILIKE $2 ESCAPE '\\'
    )`;
  }
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  params.push(lim, off);
  const r = await client.query(
    `SELECT id, name, description, ${priceCols} stock, category_id, seller_id, ${imgCols} is_cancelled${lsCol}${modCol}, created_at
     FROM products p WHERE p.seller_id = $1::uuid ${extra}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

export async function listAllProducts(client) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const hasMod = await hasModerationFeedbackColumn(client);
  const priceCols = hasPb ? 'price, regular_price, sale_price,' : 'price,';
  const imgCols = hasImgs ? 'image_url, image_urls,' : 'image_url,';
  const lsCol = hasLs ? ', listing_status' : '';
  const modCol = hasMod ? ', moderation_feedback' : '';
  const r = await client.query(
    `SELECT id, name, description, ${priceCols} stock, category_id, seller_id, ${imgCols} is_cancelled${lsCol}${modCol}, created_at
     FROM products ORDER BY created_at DESC`
  );
  return r.rows;
}

export async function countAllProductsForAdmin(client, search) {
  const like = ilikeContainsPattern(search);
  const params = [];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      p.name ILIKE $1 ESCAPE '\\'
      OR COALESCE(p.description,'') ILIKE $1 ESCAPE '\\'
      OR CAST(p.seller_id AS TEXT) ILIKE $1 ESCAPE '\\'
      OR CAST(p.id AS TEXT) ILIKE $1 ESCAPE '\\'
    )`;
  }
  const r = await client.query(`SELECT COUNT(*)::int AS c FROM products p WHERE 1=1 ${extra}`, params);
  return r.rows[0]?.c ?? 0;
}

export async function listAllProductsPaged(client, { limit, offset, search }) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  const hasMod = await hasModerationFeedbackColumn(client);
  const priceCols = hasPb ? 'price, regular_price, sale_price,' : 'price,';
  const imgCols = hasImgs ? 'image_url, image_urls,' : 'image_url,';
  const lsCol = hasLs ? ', listing_status' : '';
  const modCol = hasMod ? ', moderation_feedback' : '';
  const like = ilikeContainsPattern(search);
  const params = [];
  let extra = '';
  if (like) {
    params.push(like);
    extra = ` AND (
      p.name ILIKE $1 ESCAPE '\\'
      OR COALESCE(p.description,'') ILIKE $1 ESCAPE '\\'
      OR CAST(p.seller_id AS TEXT) ILIKE $1 ESCAPE '\\'
      OR CAST(p.id AS TEXT) ILIKE $1 ESCAPE '\\'
    )`;
  }
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const off = Math.max(Number(offset) || 0, 0);
  params.push(lim, off);
  const r = await client.query(
    `SELECT id, name, description, ${priceCols} stock, category_id, seller_id, ${imgCols} is_cancelled${lsCol}${modCol}, created_at
     FROM products p WHERE 1=1 ${extra}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

/** สำหรับ merge ราคาตอน update — เช็กเจ้าของสินค้า */
export async function getProductRowForPriceMerge(client, productId, sellerId, isAdmin) {
  const hasPb = await hasProductPriceBreakdown(client);
  const cols = hasPb
    ? 'id, price, regular_price, sale_price, seller_id'
    : 'id, price, seller_id';
  let sql = `SELECT ${cols} FROM products WHERE id = $1 AND is_cancelled = false`;
  const params = [productId];
  if (!isAdmin) {
    params.push(sellerId);
    sql += ` AND seller_id = $2`;
  }
  const r = await client.query(sql, params);
  return r.rows[0] || null;
}

export async function updateProduct(client, productId, body, sellerId, isAdmin) {
  const hasLs = await hasListingStatusColumn(client);
  const hasPb = await hasProductPriceBreakdown(client);
  const hasImgs = await hasProductImageUrlsColumn(client);
  if (!hasLs && isAdmin && body.listing_status !== undefined) {
    throw new AppError(
      'Cannot set listing_status: database has no products.listing_status column. Run backend/db/schema.sql (ALTER that adds listing_status) or npm run db:schema in backend.',
      400,
      'LISTING_STATUS_UNAVAILABLE'
    );
  }

  const tagIdsExplicit = Object.prototype.hasOwnProperty.call(body, 'tag_ids');
  const tagPayload = tagIdsExplicit ? (Array.isArray(body.tag_ids) ? body.tag_ids : []) : null;
  const hasMod = await hasModerationFeedbackColumn(client);
  const modKeysExplicit = Object.prototype.hasOwnProperty.call(body, 'moderation_issue_keys');
  const modMsgExplicit = Object.prototype.hasOwnProperty.call(body, 'moderation_message');
  const modKeysRaw = body.moderation_issue_keys;
  const modMsgRaw = body.moderation_message;
  /** ไม่มีคอลัมน์ moderation_feedback → ข้ามการบันทึก feedback (ไม่ throw) จนกว่าจะรัน migration */
  if (!hasMod && isAdmin && process.env.NODE_ENV !== 'test') {
    const sentModerationPayload =
      (modKeysExplicit && Array.isArray(modKeysRaw) && modKeysRaw.length > 0) ||
      (modMsgExplicit && String(modMsgRaw ?? '').trim().length > 0);
    if (sentModerationPayload) {
      console.warn(
        '[products] moderation_feedback column missing — feedback not saved. Run: backend/db/migrations/20260409_product_moderation_feedback.sql'
      );
    }
  }

  const sqlBody = { ...body };
  delete sqlBody.tag_ids;
  delete sqlBody.moderation_issue_keys;
  delete sqlBody.moderation_message;

  const sets = [];
  const params = [];
  let n = 1;
  if (sqlBody.name !== undefined) {
    sets.push(`name = $${n++}`);
    params.push(sqlBody.name);
  }
  if (sqlBody.description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(sqlBody.description);
  }
  if (sqlBody.price !== undefined) {
    sets.push(`price = $${n++}`);
    params.push(sqlBody.price);
  }
  if (hasPb && sqlBody.regular_price !== undefined) {
    sets.push(`regular_price = $${n++}`);
    params.push(sqlBody.regular_price);
  }
  if (hasPb && Object.prototype.hasOwnProperty.call(sqlBody, 'sale_price')) {
    sets.push(`sale_price = $${n++}`);
    params.push(sqlBody.sale_price);
  }
  if (sqlBody.stock !== undefined) {
    sets.push(`stock = $${n++}`);
    params.push(sqlBody.stock);
  }
  if (sqlBody.category_id !== undefined) {
    sets.push(`category_id = $${n++}`);
    params.push(sqlBody.category_id && sqlBody.category_id !== '' ? sqlBody.category_id : null);
  }
  if (sqlBody.image_url !== undefined) {
    sets.push(`image_url = $${n++}`);
    params.push(sqlBody.image_url || null);
  }
  if (hasImgs && sqlBody.image_urls !== undefined) {
    const imageUrls = Array.isArray(sqlBody.image_urls)
      ? sqlBody.image_urls.map((u) => String(u || '').trim()).filter(Boolean)
      : [];
    sets.push(`image_urls = $${n++}::text[]`);
    params.push(imageUrls.length ? imageUrls : null);
    if (sqlBody.image_url === undefined) {
      sets.push(`image_url = $${n++}`);
      params.push(imageUrls[0] || null);
    }
  }
  if (hasLs && sqlBody.listing_status !== undefined && isAdmin) {
    sets.push(`listing_status = $${n++}`);
    params.push(sqlBody.listing_status);
  }

  if (hasMod && isAdmin) {
    const publishClear =
      hasLs &&
      Object.prototype.hasOwnProperty.call(sqlBody, 'listing_status') &&
      sqlBody.listing_status === 'published';
    if (publishClear) {
      sets.push(`moderation_feedback = $${n++}`);
      params.push(null);
    } else if (modKeysExplicit || modMsgExplicit) {
      const issues =
        modKeysExplicit && Array.isArray(modKeysRaw)
          ? [...new Set(modKeysRaw.map((k) => String(k)))].filter((k) =>
              MODERATION_ISSUE_KEYS.has(k)
            )
          : [];
      const message =
        modMsgExplicit && modMsgRaw != null ? String(modMsgRaw).trim() : '';
      const payload =
        issues.length > 0 || message.length > 0
          ? JSON.stringify({
              issues,
              message,
              at: new Date().toISOString(),
            })
          : null;
      sets.push(`moderation_feedback = $${n++}::jsonb`);
      params.push(payload);
    }
  }

  if (sets.length) {
    params.push(productId);
    let sql = `UPDATE products SET ${sets.join(', ')} WHERE id = $${n}`;
    if (!isAdmin) {
      params.push(sellerId);
      sql += ` AND seller_id = $${n + 1}`;
    }
    const ret = await returningProductColumns(client);
    sql += ` RETURNING ${ret}`;
    const r = await client.query(sql, params);
    if (!r.rows[0]) return null;
  } else if (tagPayload === null) {
    return null;
  } else {
    const chkParams = [productId];
    let chkSql = `SELECT 1 FROM products WHERE id = $1 AND is_cancelled = false`;
    if (!isAdmin) {
      chkParams.push(sellerId);
      chkSql += ` AND seller_id = $2`;
    }
    const chk = await client.query(chkSql, chkParams);
    if (!chk.rows[0]) return null;
  }

  if (tagPayload !== null) {
    await replaceProductTags(client, productId, tagPayload);
  }

  return getProductById(client, productId, {
    includeCancelled: false,
    requirePublished: false,
    viewerSellerId: null,
  });
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
