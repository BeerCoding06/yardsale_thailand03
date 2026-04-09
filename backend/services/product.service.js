import { AppError } from '../utils/AppError.js';
import { paginationMeta, parsePaginationQuery } from '../utils/pagination.js';
import * as productModel from '../models/product.model.js';
import { pool } from '../models/db.js';

export async function listProducts(query) {
  const client = await pool.connect();
  try {
    const search = query.search || query.q;
    const categoryId = query.category_id;
    const categorySlug = query.category;
    const wantsPaging =
      (query.page != null && String(query.page).trim() !== '') ||
      query.page_size != null ||
      query.pageSize != null;

    if (!wantsPaging) {
      const rows = await productModel.listProducts(client, {
        search,
        categoryId,
        categorySlug,
        publicOnly: true,
      });
      return { products: rows, count: rows.length, pagination: null };
    }

    const { page, pageSize, offset } = parsePaginationQuery(query, {
      defaultPageSize: 24,
      maxPageSize: 60,
    });
    const total = await productModel.countListProducts(client, {
      search,
      categoryId,
      categorySlug,
      publicOnly: true,
    });
    const rows = await productModel.listProducts(client, {
      search,
      categoryId,
      categorySlug,
      publicOnly: true,
      limit: pageSize,
      offset,
    });
    return {
      products: rows,
      count: rows.length,
      pagination: paginationMeta({ page, pageSize, total }),
    };
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

export async function searchProducts(q, query = {}) {
  const client = await pool.connect();
  try {
    const wantsPaging =
      (query.page != null && String(query.page).trim() !== '') ||
      query.page_size != null ||
      query.pageSize != null;
    if (!wantsPaging) {
      const rows = await productModel.listProducts(client, { search: q, publicOnly: true });
      return { products: rows, count: rows.length, pagination: null };
    }
    const { page, pageSize, offset } = parsePaginationQuery(query, {
      defaultPageSize: 24,
      maxPageSize: 60,
    });
    const total = await productModel.countListProducts(client, { search: q, publicOnly: true });
    const rows = await productModel.listProducts(client, {
      search: q,
      publicOnly: true,
      limit: pageSize,
      offset,
    });
    return {
      products: rows,
      count: rows.length,
      pagination: paginationMeta({ page, pageSize, total }),
    };
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
