import { AppError } from '../utils/AppError.js';
import * as productModel from '../models/product.model.js';
import { pool } from '../models/db.js';

export async function listProducts(query) {
  const client = await pool.connect();
  try {
    const search = query.search || query.q;
    const categoryId = query.category_id;
    const categorySlug = query.category;
    const rows = await productModel.listProducts(client, {
      search,
      categoryId,
      categorySlug,
      publicOnly: true,
    });
    return { products: rows, count: rows.length };
  } finally {
    client.release();
  }
}

export async function getProduct(id, { includeCancelled, viewerUserId, viewerRole } = {}) {
  const client = await pool.connect();
  try {
    const isAdmin = viewerRole === 'admin';
    const p = await productModel.getProductById(client, id, {
      includeCancelled: isAdmin,
      requirePublished: !isAdmin,
      viewerSellerId: !isAdmin && viewerUserId ? viewerUserId : null,
    });
    if (!p) throw new AppError('Product not found', 404, 'NOT_FOUND');
    return p;
  } finally {
    client.release();
  }
}

export async function searchProducts(q) {
  const client = await pool.connect();
  try {
    const rows = await productModel.listProducts(client, { search: q, publicOnly: true });
    return { products: rows, count: rows.length };
  } finally {
    client.release();
  }
}

/** Compatibility: wp-post style by id */
export async function getWpPost(id) {
  const client = await pool.connect();
  try {
    const p = await productModel.getProductById(client, id, {
      includeCancelled: false,
      requirePublished: true,
      viewerSellerId: null,
    });
    if (!p) throw new AppError('Product not found', 404, 'NOT_FOUND');
    return { post: p, product: p };
  } finally {
    client.release();
  }
}
