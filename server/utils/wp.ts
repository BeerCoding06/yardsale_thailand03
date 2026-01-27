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
 * @returns Full WordPress API URL
 */
export function buildWpApiUrl(endpoint: string, params?: Record<string, string | number>): string {
  const baseUrl = getWpBaseUrl();
  let url = `${baseUrl}/wp-json/${endpoint}`;
  
  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    url += `?${queryString}`;
  }
  
  return url;
}

/**
 * Get WordPress API headers with authentication
 * @param useBasicAuth - Use Basic Auth (default: true)
 * @param useWooCommerceAuth - Use WooCommerce Consumer Key/Secret (default: false)
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
    }
  }
  
  return headers;
}
