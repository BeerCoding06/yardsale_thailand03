import { AppError } from '../utils/AppError.js';
import { pool } from '../models/db.js';
import * as cartModel from '../models/cart.model.js';
import * as productModel from '../models/product.model.js';

export async function addToCart(userId, productId, quantity) {
  const client = await pool.connect();
  try {
    const p = await productModel.getProductForPurchase(client, productId);
    if (!p) {
      throw new AppError('Product not found or not available for sale', 404, 'NOT_FOUND');
    }
    const cartId = await cartModel.getOrCreateCart(client, userId);
    await cartModel.addOrUpdateItem(client, cartId, productId, quantity);
    const items = await cartModel.getCartItems(client, cartId);
    return { cart_id: cartId, items };
  } finally {
    client.release();
  }
}

export async function updateCart(userId, items) {
  const client = await pool.connect();
  try {
    const cartId = await cartModel.getOrCreateCart(client, userId);
    const normalized = items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
    }));
    await cartModel.setCartItems(client, cartId, normalized);
    const out = await cartModel.getCartItems(client, cartId);
    return { cart_id: cartId, items: out };
  } finally {
    client.release();
  }
}

export async function refreshCartStock(userId) {
  const client = await pool.connect();
  try {
    const cartId = await cartModel.getOrCreateCart(client, userId);
    const items = await cartModel.getCartItems(client, cartId);
    return { items };
  } finally {
    client.release();
  }
}

export async function checkCartStock(items) {
  const client = await pool.connect();
  try {
    const errors = [];
    for (const it of items) {
      const p = await productModel.getProductForPurchase(client, it.product_id);
      if (!p) {
        errors.push({ product_id: it.product_id, message: 'Product unavailable' });
        continue;
      }
      if (p.stock < it.quantity) {
        errors.push({
          product_id: it.product_id,
          message: `Insufficient stock (have ${p.stock}, need ${it.quantity})`,
        });
      }
    }
    return { valid: errors.length === 0, errors };
  } finally {
    client.release();
  }
}
