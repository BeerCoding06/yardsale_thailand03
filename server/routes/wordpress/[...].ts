// Proxy all WordPress requests to internal WordPress instance via Nginx
// WordPress is served by Nginx in the same container, so we use internal URL
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  
  // Redirect incorrect wp-admin.php to wp-admin/
  if (event.path === '/wordpress/wp-admin.php') {
    return sendRedirect(event, '/wordpress/wp-admin/', 301);
  }
  
  // Use internal URL for container communication (Nginx on port 80)
  // Nuxt.js uses port 3000, Nginx uses port 80 and proxies to Nuxt.js
  // Try multiple internal URLs for reliability
  const internalBaseUrl = process.env.INTERNAL_BASE_URL || 'http://127.0.0.1:80';
  const internalUrls = [
    internalBaseUrl,
    'http://127.0.0.1:80',
    'http://localhost:80',
  ];
  
  // Get the path - keep /wordpress prefix for Nginx routing
  // Nginx expects /wordpress/ prefix for WordPress routes
  let path = event.path;
  // Ensure path starts with /wordpress
  if (!path.startsWith('/wordpress')) {
    // If path doesn't start with /wordpress, add it
    path = '/wordpress' + (path.startsWith('/') ? path : '/' + path);
  }
  
  // Get query string if present
  const queryString = getQuery(event);
  const queryParams = new URLSearchParams(queryString as Record<string, string>).toString();
  
  // Build the target URL (Nginx expects /wordpress prefix)
  const wpPath = queryParams ? `${path}?${queryParams}` : path;
  
  // Log for debugging
  console.log(`[WordPress Proxy] Proxying ${event.method} ${event.path} to internal Nginx`);
  
  // Try each internal URL until one works
  let lastError: any = null;
  for (const baseUrl of internalUrls) {
    const finalUrl = `${baseUrl}${wpPath}`;
    
    try {
      console.log(`[WordPress Proxy] Trying: ${finalUrl}`);
      
      // Forward the request to WordPress via Nginx
      const response = await fetch(finalUrl, {
        method: event.method,
        headers: {
          ...Object.fromEntries(
            Object.entries(getHeaders(event)).filter(([key]) => 
              !['host', 'connection', 'content-length'].includes(key.toLowerCase())
            )
          ),
          // Set Host header to match the original request for proper routing
          'Host': getHeader(event, 'host') || 'localhost',
          // Add basic auth if configured
          ...(config.wpBasicAuth ? { 'Authorization': `Basic ${config.wpBasicAuth}` } : {}),
        },
        body: event.method !== 'GET' && event.method !== 'HEAD' 
          ? await readRawBody(event).catch(() => null)
          : undefined,
      });
      
      // Get response body
      const body = await response.arrayBuffer();
      
      // Set response headers (exclude some that shouldn't be forwarded)
      const headersToExclude = ['connection', 'transfer-encoding', 'content-encoding'];
      response.headers.forEach((value, key) => {
        if (!headersToExclude.includes(key.toLowerCase())) {
          setHeader(event, key, value);
        }
      });
      
      // Set status code
      setResponseStatus(event, response.status);
      
      // Return the response
      return new Uint8Array(body);
    } catch (error: any) {
      lastError = error;
      console.warn(`[WordPress Proxy] Failed to connect to ${finalUrl}:`, error?.message);
      // Continue to next URL
    }
  }
  
  // All URLs failed
  console.error(`[WordPress Proxy] All internal URLs failed. Last error:`, lastError);
  const errorMessage = lastError?.message || String(lastError);
  
  throw createError({
    statusCode: 502,
    statusMessage: 'Bad Gateway',
    message: `Cannot connect to WordPress. Please check that WordPress is running and Nginx is properly configured. Error: ${errorMessage}`,
  });
});
