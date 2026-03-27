import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as productModel from '../models/product.model.js';
import * as userModel from '../models/user.model.js';
import {
  mergeProductPricesForUpdate,
  normalizeProductPricesForCreate,
} from '../utils/productPrices.js';

export async function myProducts(userId, role, { ownOnly = false } = {}) {
  const client = await pool.connect();
  try {
    if (role === 'admin' && !ownOnly) {
      const products = await productModel.listAllProducts(client);
      return { products, count: products.length };
    }
    const products = await productModel.listProductsBySeller(client, userId);
    return { products, count: products.length };
  } finally {
    client.release();
  }
}

export async function createProduct(sellerId, body, role) {
  const client = await pool.connect();
  try {
    let ownerId = sellerId;
    if (role === 'admin' && body.seller_id) {
      const u = await userModel.findUserById(client, body.seller_id);
      if (!u) throw new AppError('Seller user not found', 404, 'NOT_FOUND');
      ownerId = body.seller_id;
    }
    const listing_status =
      role === 'admin' && body.listing_status ? body.listing_status : 'pending_review';
    const np = normalizeProductPricesForCreate(body);
    const tag_ids = Array.isArray(body.tag_ids)
      ? body.tag_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const imageUrls = Array.isArray(body.image_urls)
      ? body.image_urls.map((u) => String(u || '').trim()).filter(Boolean)
      : [];
    const imageUrl = body.image_url || imageUrls[0] || null;
    const row = await productModel.createProduct(client, {
      seller_id: ownerId,
      category_id: body.category_id && body.category_id !== '' ? body.category_id : null,
      name: body.name,
      description: body.description,
      price: np.price,
      regular_price: np.regular_price,
      sale_price: np.sale_price,
      stock: body.stock,
      image_url: imageUrl,
      image_urls: imageUrls,
      listing_status,
      tag_ids,
    });
    return { product: row };
  } finally {
    client.release();
  }
}

export async function updateProduct(userId, role, body) {
  const isAdmin = role === 'admin';
  const client = await pool.connect();
  try {
    const { product_id, ...rest } = body;
    if (!isAdmin) delete rest.listing_status;

    const hasPriceKeys =
      rest.price !== undefined ||
      rest.regular_price !== undefined ||
      Object.prototype.hasOwnProperty.call(rest, 'sale_price');

    let patch = { ...rest };
    if (hasPriceKeys) {
      const current = await productModel.getProductRowForPriceMerge(
        client,
        product_id,
        userId,
        isAdmin
      );
      if (!current) throw new AppError('Product not found or not yours', 404, 'NOT_FOUND');
      const merged = mergeProductPricesForUpdate(rest, current);
      patch = { ...rest, ...merged };
    }

    const row = await productModel.updateProduct(
      client,
      product_id,
      patch,
      userId,
      isAdmin
    );
    if (!row) throw new AppError('Product not found or not yours', 404, 'NOT_FOUND');
    return { product: row };
  } finally {
    client.release();
  }
}

export async function cancelProduct(sellerId, productId, role) {
  const isAdmin = role === 'admin';
  const client = await pool.connect();
  try {
    let row;
    if (isAdmin) {
      row = await productModel.setProductCancelledById(client, productId, true);
    } else {
      row = await productModel.setProductCancelled(client, productId, sellerId, true);
    }
    if (!row) throw new AppError('Product not found or not yours', 404, 'NOT_FOUND');
    return { product: row };
  } finally {
    client.release();
  }
}

export async function restoreProduct(sellerId, productId, role) {
  const isAdmin = role === 'admin';
  const client = await pool.connect();
  try {
    let row;
    if (isAdmin) {
      row = await productModel.setProductCancelledById(client, productId, false);
    } else {
      row = await productModel.setProductCancelled(client, productId, sellerId, false);
    }
    if (!row) throw new AppError('Product not found or not yours', 404, 'NOT_FOUND');
    return { product: row };
  } finally {
    client.release();
  }
}
