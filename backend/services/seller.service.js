import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as productModel from '../models/product.model.js';
import * as userModel from '../models/user.model.js';

export async function myProducts(userId, role) {
  const client = await pool.connect();
  try {
    if (role === 'admin') {
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
    const row = await productModel.createProduct(client, {
      seller_id: ownerId,
      category_id: body.category_id && body.category_id !== '' ? body.category_id : null,
      name: body.name,
      description: body.description,
      price: body.price,
      stock: body.stock,
      image_url: body.image_url || null,
      listing_status,
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
    const row = await productModel.updateProduct(
      client,
      product_id,
      rest,
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
