import { pool } from '../models/db.js';
import { AppError } from '../utils/AppError.js';

export function slugifyCategoryName(name) {
  const s = String(name || '')
    .trim()
    .toLowerCase();
  const out = s
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return out || 'category';
}

export async function listCategories() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, name, slug, image_url, created_at FROM categories ORDER BY name`
    );
    return r.rows;
  } finally {
    client.release();
  }
}

/**
 * @param {{ name: string, slug?: string | null, image_url?: string | null }} input
 */
export async function createCategory(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new AppError('Category name is required', 400, 'VALIDATION_ERROR');
  const slugInput = input.slug != null && String(input.slug).trim() !== '' ? String(input.slug).trim().toLowerCase() : null;
  const finalSlug = slugInput || slugifyCategoryName(name);
  const image_url =
    input.image_url != null && String(input.image_url).trim() !== ''
      ? String(input.image_url).trim()
      : null;

  const client = await pool.connect();
  try {
    const r = await client.query(
      `INSERT INTO categories (name, slug, image_url) VALUES ($1, $2, $3)
       RETURNING id, name, slug, image_url, created_at`,
      [name, finalSlug, image_url]
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
 * @param {string} categoryId
 * @param {{ name?: string, slug?: string | null, image_url?: string | null }} body
 */
export async function updateCategory(categoryId, body) {
  const id = String(categoryId || '').trim();
  if (!id) throw new AppError('category_id is required', 400, 'VALIDATION_ERROR');

  const hasName = body.name !== undefined;
  const hasSlug = body.slug !== undefined;
  const hasImage = body.image_url !== undefined;
  if (!hasName && !hasSlug && !hasImage) {
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
          const cur = await client.query('SELECT name FROM categories WHERE id = $1', [id]);
          if (!cur.rows[0]) throw new AppError('Category not found', 404, 'NOT_FOUND');
          nameForSlug = String(cur.rows[0].name || '');
        }
        finalSlug = slugifyCategoryName(nameForSlug);
      }
      sets.push(`slug = $${n++}`);
      params.push(finalSlug);
    }

    if (hasImage) {
      const v = body.image_url;
      const cleaned =
        v != null && String(v).trim() !== '' ? String(v).trim() : null;
      sets.push(`image_url = $${n++}`);
      params.push(cleaned);
    }

    params.push(id);
    const r = await client.query(
      `UPDATE categories SET ${sets.join(', ')} WHERE id = $${n} RETURNING id, name, slug, image_url, created_at`,
      params
    );
    if (!r.rows[0]) throw new AppError('Category not found', 404, 'NOT_FOUND');
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

/** products.category_id เป็น ON DELETE SET NULL — ลบหมวดได้ */
export async function deleteCategory(categoryId) {
  const id = String(categoryId || '').trim();
  if (!id) throw new AppError('category_id is required', 400, 'VALIDATION_ERROR');
  const client = await pool.connect();
  try {
    const r = await client.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (!r.rows[0]) throw new AppError('Category not found', 404, 'NOT_FOUND');
    return { id: r.rows[0].id };
  } finally {
    client.release();
  }
}
