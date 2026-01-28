// server/utils/wp.ts
// WordPress API utility functions

/**
 * Get WordPress base URL from runtime config
 * @returns WordPress base URL (without trailing slash)
 */
export function getWpBaseUrl(): string {
  const config = useRuntimeConfig();
  let wpBaseUrl = config.wpBaseUrl || 'http://157.85.98.150:8080';
  
  // Ensure it has protocol
  if (!wpBaseUrl.match(/^https?:\/\//)) {
    wpBaseUrl = `http://${wpBaseUrl}`;
  }
  
  // Remove trailing slash
  return wpBaseUrl.replace(/\/$/, '');
}

/**
 * Get WordPress Basic Auth from runtime config
 * @returns Basic Auth string or null
 */
export function getWpBasicAuth(): string | null {
  const config = useRuntimeConfig();
  return config.wpBasicAuth || null;
}

/**
 * Get WooCommerce Consumer Key from runtime config
 * @returns Consumer Key or null
 */
export function getWpConsumerKey(): string | null {
  const config = useRuntimeConfig();
  return config.wpConsumerKey || null;
}

/**
 * Get WooCommerce Consumer Secret from runtime config
 * @returns Consumer Secret or null
 */
export function getWpConsumerSecret(): string | null {
  const config = useRuntimeConfig();
  return config.wpConsumerSecret || null;
}

/**
 * Build WordPress REST API URL
 * @param endpoint - API endpoint (e.g., 'wp/v2/users', 'wc/v3/products')
 * @param params - Query parameters (optional)
 * @param useWooCommerceAuth - Add consumer_key and consumer_secret to query params (default: false)
 * @returns Full WordPress API URL
 */
export function buildWpApiUrl(endpoint: string, params?: Record<string, string | number>, useWooCommerceAuth: boolean = false): string {
  const baseUrl = getWpBaseUrl();
  let url = `${baseUrl}/wp-json/${endpoint}`;
  
  // Build query parameters
  const queryParams: Record<string, string> = {};
  
  // Add WooCommerce credentials to query params if requested
  if (useWooCommerceAuth) {
    const consumerKey = getWpConsumerKey();
    const consumerSecret = getWpConsumerSecret();
    if (consumerKey && consumerSecret) {
      queryParams['consumer_key'] = consumerKey;
      queryParams['consumer_secret'] = consumerSecret;
    }
  }
  
  // Add other params
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([key, value]) => {
      queryParams[key] = String(value);
    });
  }
  
  // Build query string
  if (Object.keys(queryParams).length > 0) {
    const queryString = new URLSearchParams(queryParams).toString();
    url += `?${queryString}`;
  }
  
  return url;
}

/**
 * Build WooCommerce REST API URL with consumer_key and consumer_secret in query params
 * @param endpoint - WooCommerce API endpoint (e.g., 'wc/v3/products', 'wc/v3/orders')
 * @param params - Query parameters (optional)
 * @returns Full WooCommerce API URL with authentication in query params
 */
export function buildWcApiUrl(endpoint: string, params?: Record<string, string | number>): string {
  const consumerKey = getWpConsumerKey();
  const consumerSecret = getWpConsumerSecret();
  
  const wcParams: Record<string, string | number> = {
    ...(params || {}),
  };
  
  // Add consumer_key and consumer_secret to query params
  if (consumerKey && consumerSecret) {
    wcParams['consumer_key'] = consumerKey;
    wcParams['consumer_secret'] = consumerSecret;
  }
  
  return buildWpApiUrl(endpoint, wcParams, false);
}

/**
 * Get WordPress API headers with authentication
 * @param useBasicAuth - Use Basic Auth (default: true)
 * @param useWooCommerceAuth - Use WooCommerce Consumer Key/Secret (default: false) - DEPRECATED: Use buildWcApiUrl instead
 * @returns Headers object
 */
export function getWpApiHeaders(useBasicAuth: boolean = true, useWooCommerceAuth: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (useBasicAuth) {
    const basicAuth = getWpBasicAuth();
    if (basicAuth) {
      headers['Authorization'] = `Basic ${basicAuth}`;
    }
  }
  
  if (useWooCommerceAuth) {
    const consumerKey = getWpConsumerKey();
    const consumerSecret = getWpConsumerSecret();
    if (consumerKey && consumerSecret) {
      // Use Node.js Buffer (always available in server environment)
      const authString = `${consumerKey}:${consumerSecret}`;
      const auth = Buffer.from(authString).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    } else {
      console.warn('[wp] WooCommerce Consumer Key/Secret not configured. Set WP_CONSUMER_KEY and WP_CONSUMER_SECRET in .env file');
    }
  }
  
  return headers;
}
