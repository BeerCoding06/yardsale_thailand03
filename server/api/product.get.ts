// server/api/product.get.ts
// Fetch single product via PHP API endpoint, with Node fallback when id is provided

import { executePhpScript } from '../utils/php-executor';
import { rewriteWpUrlsInObject } from '../utils/rewrite-wp-urls';

const wpBaseDefault = 'https://cms.yardsaleth.com';

/** แปลง WooCommerce API response เป็นรูปแบบเดียวกับ getProduct.php (เมื่อใช้ fallback) */
function formatWcProductToOurShape(wc: any, productId: number): any {
  const images = (wc?.images && Array.isArray(wc.images)) ? wc.images : [];
  const imageUrl = images[0]?.src ?? null;
  const galleryImages = images.map((img: any) => ({ sourceUrl: img?.src })).filter((n: any) => n.sourceUrl);
  const reg = wc?.regular_price ?? wc?.price ?? '';
  const sale = wc?.sale_price ?? '';
  const formatPrice = (val: string | number) => {
    const n = typeof val === 'string' ? parseFloat(val) : val;
    if (!Number.isFinite(n) || n <= 0) return null;
    return `<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">฿</span>${Math.round(n).toLocaleString()}</span>`;
  };
  return {
    product: {
      databaseId: productId,
      sku: wc?.sku ?? wc?.slug ?? `product-${productId}`,
      slug: wc?.slug ?? '',
      name: wc?.name ?? '',
      description: wc?.description ?? '',
      regularPrice: formatPrice(reg) ?? '',
      salePrice: sale ? formatPrice(sale) : null,
      stockQuantity: wc?.stock_quantity != null ? Number(wc.stock_quantity) : null,
      stockStatus: (wc?.stock_status ?? 'instock').toString().toUpperCase().replace(/\s/g, '_'),
      status: wc?.status ?? 'publish',
      image: imageUrl ? { sourceUrl: imageUrl } : null,
      galleryImages: { nodes: galleryImages },
      allPaColor: { nodes: [] },
      allPaStyle: { nodes: [] },
      related: { nodes: [] },
      variations: { nodes: [] },
    },
  };
}

export default cachedEventHandler(
  async (event) => {
    const config = useRuntimeConfig();
    const query = getQuery(event);
    const slug = query.slug as string | undefined;
    const sku = query.sku as string | undefined;
    const idRaw = query.id;
    const id = idRaw != null ? Number(idRaw) : undefined;
    const hasId = id != null && !Number.isNaN(id);

    if (!slug && !sku && !hasId) {
      return { product: null };
    }

    const wpBase = config.wpBaseUrl || wpBaseDefault;
    const siteBase = config.wpMediaUrl || config.wpProxyPublicUrl || config.baseUrl || wpBaseDefault;

    // 1) ลอง PHP ก่อน
    try {
      const queryParams: Record<string, string | number> = {};
      if (slug) queryParams.slug = slug;
      if (sku) queryParams.sku = sku;
      if (hasId) queryParams.id = id!;

      const phpEnv: Record<string, string> = {};
      if (config.wpBaseUrl) phpEnv.WP_BASE_URL = config.wpBaseUrl;
      if (config.wpBasicAuth) phpEnv.WP_BASIC_AUTH = config.wpBasicAuth;
      if (config.wpConsumerKey) phpEnv.WP_CONSUMER_KEY = config.wpConsumerKey;
      if (config.wpConsumerSecret) phpEnv.WP_CONSUMER_SECRET = config.wpConsumerSecret;

      const data = await executePhpScript({
        script: 'getProduct.php',
        queryParams,
        method: 'GET',
        env: phpEnv,
      });

      if (data && (data.success === false || data.error)) {
        console.warn('[product] PHP/WooCommerce error:', data.error || data);
        if (hasId) {
          const fallback = await fetchProductByIdFallback(id!, config);
          if (fallback) return rewriteWpUrlsInObject(fallback, wpBase, siteBase);
        }
        return { product: null };
      }
      if (data?.product) {
        return rewriteWpUrlsInObject(data, wpBase, siteBase);
      }
    } catch (err: any) {
      console.error('[product] PHP failed:', err?.message || err);
      if (hasId) {
        const fallback = await fetchProductByIdFallback(id!, config);
        if (fallback) return rewriteWpUrlsInObject(fallback, wpBase, siteBase);
      }
      return { product: null };
    }

    // 2) ถ้ามี id แต่ PHP ไม่คืน product ลองดึงจาก WooCommerce โดยตรง (fallback)
    if (hasId) {
      const fallback = await fetchProductByIdFallback(id!, config);
      if (fallback) return rewriteWpUrlsInObject(fallback, wpBase, siteBase);
    }

    return { product: null };
  },
  { maxAge: 1, swr: false, getKey: (e) => e.req.url! }
);

/** Fallback: ดึง product by ID จาก WooCommerce โดยตรง (ไม่ผ่าน PHP) สำหรับเมื่อ PHP ล้มเหลวหรือไม่มี PHP */
async function fetchProductByIdFallback(
  productId: number,
  config: ReturnType<typeof useRuntimeConfig>
): Promise<{ product: any } | null> {
  const base = (config.wpBaseUrl || wpBaseDefault).replace(/\/$/, '');
  let url = `${base}/wp-json/wc/v3/products/${productId}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  // ใช้ consumer_key/consumer_secret ก่อน (ตรงกับ getProducts ที่ไม่เจอ 401)
  if (config.wpConsumerKey && config.wpConsumerSecret) {
    const q = new URLSearchParams({
      consumer_key: config.wpConsumerKey,
      consumer_secret: config.wpConsumerSecret,
    });
    url += (url.includes('?') ? '&' : '?') + q.toString();
  } else if (config.wpBasicAuth) {
    const buf = (globalThis as any).Buffer;
    const encoded = buf ? buf.from(config.wpBasicAuth, 'utf8').toString('base64') : (typeof btoa !== 'undefined' ? btoa(config.wpBasicAuth) : '');
    if (encoded) headers.Authorization = `Basic ${encoded}`;
  }
  try {
    const wc = await $fetch<any>(url, { headers });
    if (wc && (wc.id === productId || wc.id === Number(productId))) {
      console.log('[product] Fallback: got product by ID from WooCommerce', productId);
      return formatWcProductToOurShape(wc, productId);
    }
  } catch (e: any) {
    console.warn('[product] Fallback fetch failed:', e?.message || e);
  }
  return null;
}
