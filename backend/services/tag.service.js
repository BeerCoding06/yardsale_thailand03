import { pool } from '../models/db.js';
import { AppError } from '../utils/AppError.js';
import { slugifyCategoryName } from './category.service.js';

/** รูปแบบใกล้ WooCommerce สำหรับฟอร์มสินค้า / wp-tags */
export function toTagNode(row) {
  if (!row) return null;
  return {
    id: row.id,
    databaseId: row.id,
    name: row.name,
    slug: row.slug,
    count: 0,
  };
}

export async function listTags() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, name, slug, created_at FROM tags ORDER BY name`
    );
    return r.rows;
  } finally {
    client.release();
  }
}

/**
 * @param {{ name: string, slug?: string | null }} input
 */
export async function createTag(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new AppError('Tag name is required', 400, 'VALIDATION_ERROR');
  const slugInput = input.slug != null && String(input.slug).trim() !== '' ? String(input.slug).trim().toLowerCase() : null;
  const finalSlug = slugInput || slugifyCategoryName(name);

  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO tags (name, slug) VALUES ($1, $2)
       RETURNING id, name, slug, created_at`,
      [name, finalSlug]
    );
    return r.rows[0];
  } catch (e) {
    if (e.code === '23505') {
      throw new AppError('Slug already exists', 409, 'DUPLICATE_SLUG');
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * @param {string} tagId
 * @param {{ name?: string, slug?: string | null }} body
 */
export async function updateTag(tagId, body) {
  const id = String(tagId || '').trim();
  if (!id) throw new AppError('tag_id is required', 400, 'VALIDATION_ERROR');

  const hasName = body.name !== undefined;
  const hasSlug = body.slug !== undefined;
  if (!hasName && !hasSlug) {
    throw new AppError('No fields to update', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    const sets = [];
    const params = [];
    let n = 1;

    if (hasName) {
      const name = String(body.name || '').trim();
      if (!name) throw new AppError('Name cannot be empty', 400, 'VALIDATION_ERROR');
      sets.push(`name = $${n++}`);
      params.push(name);
    }

    if (hasSlug) {
      const raw = body.slug;
      const trimmed = raw != null && String(raw).trim() !== '' ? String(raw).trim().toLowerCase() : '';
      let finalSlug;
      if (trimmed) {
        finalSlug = trimmed;
      } else {
        let nameForSlug = hasName ? String(body.name || '').trim() : null;
        if (!nameForSlug) {
          const cur = await client.query('SELECT name FROM tags WHERE id = $1', [id]);
          if (!cur.rows[0]) throw new AppError('Tag not found', 404, 'NOT_FOUND');
          nameForSlug = String(cur.rows[0].name || '');
        }
        finalSlug = slugifyCategoryName(nameForSlug);
      }
      sets.push(`slug = $${n++}`);
      params.push(finalSlug);
    }

    params.push(id);
    const r = await client.query(
      `UPDATE tags SET ${sets.join(', ')} WHERE id = $${n} RETURNING id, name, slug, created_at`,
      params
    );
    if (!r.rows[0]) throw new AppError('Tag not found', 404, 'NOT_FOUND');
    return r.rows[0];
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e.code === '23505') {
      throw new AppError('Slug already exists', 409, 'DUPLICATE_SLUG');
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteTag(tagId) {
  const id = String(tagId || '').trim();
  if (!id) throw new AppError('tag_id is required', 400, 'VALIDATION_ERROR');
  const client = await pool.connect();
  try {
    const r = await client.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id]);
    if (!r.rows[0]) throw new AppError('Tag not found', 404, 'NOT_FOUND');
    return { id: r.rows[0].id };
  } finally {
    client.release();
  }
}
