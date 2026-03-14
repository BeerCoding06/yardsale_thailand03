// server/api/wp-post.get.ts
// Fetch single product by ID for edit form (returns WooCommerce product with meta_data, author)

import * as wpUtils from '../utils/wp';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id ? Number(query.id) : null;

  if (id == null || Number.isNaN(id)) {
    throw createError({
      statusCode: 400,
      message: 'id is required',
    });
  }

  const url = wpUtils.buildWcApiUrl(`wc/v3/products/${id}`);

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw createError({
      statusCode: res.status === 404 ? 404 : res.status || 500,
      message: res.status === 404 ? 'Product not found' : text || `Request failed: ${res.status}`,
    });
  }

  const product = (await res.json()) as Record<string, unknown>;

  if (!product || !product.id) {
    throw createError({
      statusCode: 404,
      message: 'Product not found',
    });
  }

  const wpBaseUrl = wpUtils.getWpBaseUrl();
  const basicAuth = wpUtils.getWpBasicAuth();
  let author: number | undefined;
  try {
    const wpProductUrl = `${wpBaseUrl}/wp-json/wp/v2/product/${id}`;
    let authHeader = '';
    if (basicAuth) {
      const str = basicAuth.includes(':') ? basicAuth : Buffer.from(basicAuth, 'base64').toString('utf-8');
      authHeader = `Basic ${Buffer.from(str).toString('base64')}`;
    }
    const wpRes = await fetch(wpProductUrl, {
      method: 'GET',
      headers: authHeader ? { Authorization: authHeader } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (wpRes.ok) {
      const wpPost = (await wpRes.json()) as { author?: number };
      if (wpPost.author != null) author = wpPost.author;
    }
  } catch {
    // ignore
  }

  if (author != null) product.author = author;
  if (!Array.isArray(product.meta_data)) product.meta_data = [];

  return product;
});
