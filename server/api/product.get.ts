// server/api/product.get.ts
// Fetch single product via PHP API endpoint

import { executePhpScript } from '../utils/php-executor';
import { rewriteWpUrlsInObject } from '../utils/rewrite-wp-urls';

export default cachedEventHandler(
  async (event) => {
    try {
      const config = useRuntimeConfig();
      const query = getQuery(event);
      
      const slug = query.slug as string | undefined;
      const sku = query.sku as string | undefined;
      const id = query.id as string | undefined;
      
      if (!slug && !sku && !id) {
        return { product: null };
      }
      
      // Build query params for PHP script
      const queryParams: Record<string, string | number> = {};
      if (slug) queryParams.slug = slug;
      if (sku) queryParams.sku = sku;
      if (id) queryParams.id = Number(id);
      
      console.log('[product] Executing PHP script: getProduct.php', queryParams);
      
      // ส่ง env จาก Nuxt ไปให้ PHP เพื่อให้ WooCommerce API ใช้ได้แน่นอน (โดยเฉพาะตอน deploy)
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
      
      console.log('[product] PHP script response:', JSON.stringify(data).substring(0, 200));
      
      // PHP ส่ง error (เช่น 401, 404) จะได้ { success: false, error: "..." }
      if (data && (data.success === false || data.error)) {
        console.warn('[product] PHP/WooCommerce error:', data.error || data);
        return { product: null };
      }
      if (!data || !data.product) {
        console.warn('[product] No product data in response:', data);
        return { product: null };
      }
      
      // Rewrite WP image URLs to public CMS/media URL (fix mixed content + broken images)
      const wpBase = config.wpBaseUrl || 'http://157.85.98.150:8080';
      const siteBase = config.wpMediaUrl || config.wpProxyPublicUrl || config.baseUrl || 'https://cms.yardsaleth.com';
      return rewriteWpUrlsInObject(data, wpBase, siteBase);
    } catch (error: any) {
      console.error('[product] Error executing PHP script:', error.message || error);
      // Log full error for debugging
      if (error.stack) {
        console.error('[product] Error stack:', error.stack);
      }
      return { product: null };
    }
  },
  {
    maxAge: 1,
    swr: false,
    getKey: event => event.req.url!,
  }
);
